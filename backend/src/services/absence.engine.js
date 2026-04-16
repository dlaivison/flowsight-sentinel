/**
 * absence.engine.js — Motor de ausências FlowSight Sentinel
 */
const cron         = require('node-cron')
const { query }    = require('../db')
const fortify      = require('./fortify.service')
const alarmService = require('./alarm.service')

class AbsenceEngine {
  constructor() {
    this.isRunning   = false
    this.intervalSec = 10
    this.cronJob     = null
  }

  async start() {
    const { rows } = await query(
      "SELECT value FROM system_config WHERE key = 'polling_interval_seconds'"
    )
    if (rows[0]) this.intervalSec = parseInt(rows[0].value) || 10
    console.log(`[AbsenceEngine] Iniciando — intervalo: ${this.intervalSec}s`)
    await this._initCoverageState()
    await fortify.startEventStream((evt) => this._processEvent(evt))
    const interval = Math.max(this.intervalSec, 5)
    this.cronJob = cron.schedule(
      `*/${interval} * * * * *`,
      () => this._recalculateAllPosts()
    )
    this.isRunning = true
    console.log('[AbsenceEngine] Motor iniciado ✓')
  }

  stop() {
    if (this.cronJob) this.cronJob.stop()
    fortify.stopEventStream()
    this.isRunning = false
  }

  async _getActiveGuardsForPost(postId) {
    const today = new Date().toISOString().split('T')[0]
    const now   = new Date()
    const hm    = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0')

    const { rows: scheduleExists } = await query(`
      SELECT COUNT(*) as count FROM shift_schedules ss
      JOIN shift_types st ON st.id = ss.shift_type_id
      WHERE ss.date = $1 AND st.is_active = TRUE
    `, [today])
    const hasSchedule = parseInt(scheduleExists[0].count) > 0

    if (hasSchedule) {
      const { rows } = await query(`
        SELECT g.id AS guard_id, g.name AS guard_name, g.fortify_poi_id,
               g.photo_url, ss.post_id, ss.status AS schedule_status
        FROM shift_schedules ss
        JOIN guards g       ON g.id = ss.guard_id
        JOIN shift_types st ON st.id = ss.shift_type_id
        WHERE ss.date = $1 AND ss.status = 'active'
          AND (ss.post_id = $2 OR ss.post_id IS NULL)
          AND st.is_active = TRUE
          AND (
            (st.start_time < st.end_time AND $3::time BETWEEN st.start_time AND st.end_time)
            OR
            (st.start_time > st.end_time AND ($3::time >= st.start_time OR $3::time <= st.end_time))
          )
      `, [today, postId, hm])
      return { mode: 'schedule', guards: rows }
    } else {
      const { rows } = await query(`
        SELECT g.id AS guard_id, g.name AS guard_name, g.fortify_poi_id, g.photo_url, gpa.post_id
        FROM guards g
        JOIN guard_post_assignments gpa ON gpa.guard_id = g.id
          AND gpa.post_id = $1 AND gpa.removed_at IS NULL
        WHERE g.is_active = TRUE
      `, [postId])
      return { mode: 'fallback', guards: rows }
    }
  }

  async _processEvent(evt) {
    try {
      // 1. Registra evento de detecção
      await query(`
        INSERT INTO detection_events
          (fortify_event_id, guard_id, camera_id, detected_at, confidence, frame_image_url, raw_payload)
        SELECT $1, g.id, c.id, $4, $5, $6, $7
        FROM guards g JOIN cameras c ON c.fortify_id = $3
        WHERE g.fortify_poi_id = $2 AND g.is_active = TRUE
        ON CONFLICT (fortify_event_id) DO NOTHING
      `, [evt.fortifyEventId, evt.poiId, evt.cameraId, evt.detectedAt, evt.confidence, evt.frameImageUrl, JSON.stringify(evt.rawPayload)])

      const today = new Date().toISOString().split('T')[0]
      const now   = new Date()
      const hm    = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0')

      // 2. Encontra vigilante e posto via shift_schedules
      const { rows } = await query(`
        SELECT DISTINCT g.id AS guard_id, g.name AS guard_name,
          p.id AS post_id, p.name AS post_name,
          p.absence_threshold_seconds, p.warning_threshold_seconds, c.id AS camera_id
        FROM guards g
        JOIN shift_schedules ss ON ss.guard_id = g.id AND ss.date = $3 AND ss.status = 'active'
        JOIN shift_types st ON st.id = ss.shift_type_id AND st.is_active = TRUE
        JOIN posts p ON p.id = ss.post_id AND p.is_active = TRUE
        JOIN post_cameras pc ON pc.post_id = p.id
        JOIN cameras c ON c.id = pc.camera_id AND c.fortify_id = $2
        WHERE g.fortify_poi_id = $1 AND g.is_active = TRUE
          AND (
            (st.start_time < st.end_time AND $4::time BETWEEN st.start_time AND st.end_time)
            OR
            (st.start_time > st.end_time AND ($4::time >= st.start_time OR $4::time <= st.end_time))
          )
      `, [evt.poiId, evt.cameraId, today, hm])

      if (rows.length === 0) return

      for (const row of rows) {
        const { guards: activeGuards, mode } = await this._getActiveGuardsForPost(row.post_id)
        if (mode === 'schedule') {
          const isActive = activeGuards.some(g => g.guard_id === row.guard_id)
          if (!isActive) continue
        }

        console.log(`[AbsenceEngine] ✓ Presença: ${row.guard_name} → ${row.post_name}`)

        // 3. Atualiza absence_state INDIVIDUAL do vigilante
        await query(`
          INSERT INTO absence_state (guard_id, post_id, status, absence_minutes, last_detected_at)
          VALUES ($1, $2, 'present', 0, $3)
          ON CONFLICT (guard_id, post_id) DO UPDATE SET
            status = 'present', absence_minutes = 0,
            last_detected_at = $3, updated_at = NOW()
        `, [row.guard_id, row.post_id, evt.detectedAt])

        // 4. Atualiza post_coverage_state do posto
        await query(`
          INSERT INTO post_coverage_state
            (post_id, status, last_detected_at, last_guard_id, last_guard_name, last_camera_id, absence_seconds)
          VALUES ($1, 'covered', $2, $3, $4, $5, 0)
          ON CONFLICT (post_id) DO UPDATE SET
            status = 'covered', last_detected_at = EXCLUDED.last_detected_at,
            last_guard_id = EXCLUDED.last_guard_id, last_guard_name = EXCLUDED.last_guard_name,
            last_camera_id = EXCLUDED.last_camera_id, absence_seconds = 0, updated_at = NOW()
        `, [row.post_id, evt.detectedAt, row.guard_id, row.guard_name, row.camera_id])

        // 5. Resolve alarmes ativos do posto
        await query(`
          UPDATE alarms SET status = 'auto_resolved', acknowledged_at = NOW()
          WHERE post_id = $1 AND status IN ('active', 'snoozed')
        `, [row.post_id])
      }

      // 6. Broadcast imediato
      try {
        const snapshot = await this.getSnapshot()
        alarmService._broadcast({ type: 'SNAPSHOT_UPDATE', payload: snapshot })
      } catch(e) {}

    } catch (err) {
      console.error('[AbsenceEngine] Erro ao processar evento:', err.message)
    }
  }

  async _recalculateAllPosts() {
    try {
      const { rows: posts } = await query(`
        SELECT DISTINCT p.id, p.name, p.absence_threshold_seconds, p.warning_threshold_seconds,
          pcs.last_detected_at, pcs.last_guard_name, pcs.status AS current_status,
          pcs.last_guard_id, pcs.last_camera_id
        FROM posts p
        LEFT JOIN post_coverage_state pcs ON pcs.post_id = p.id
        WHERE p.is_active = TRUE
      `)

      const { rows: modeCfg } = await query(
        "SELECT value FROM system_config WHERE key = 'allocation_mode'"
      )
      const allocationMode = modeCfg[0]?.value || 'specific'

      for (const post of posts) {
        if (allocationMode === 'all_to_all') {
          const now        = new Date()
          const lastSeen   = post.last_detected_at ? new Date(post.last_detected_at) : null
          const absenceSec = lastSeen ? Math.floor((now - lastSeen) / 1000) : 99999
          const threshold  = post.absence_threshold_seconds || 60
          const warning    = post.warning_threshold_seconds || 30
          let newStatus = 'covered'
          if (absenceSec >= threshold) newStatus = 'alarm'
          else if (absenceSec >= warning) newStatus = 'warning'
          await query(`
            INSERT INTO post_coverage_state (post_id, status, absence_seconds, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (post_id) DO UPDATE SET
              status = EXCLUDED.status, absence_seconds = EXCLUDED.absence_seconds, updated_at = NOW()
          `, [post.id, newStatus, absenceSec === 99999 ? null : absenceSec])
          if (newStatus === 'alarm' && post.current_status !== 'alarm') {
            await alarmService.triggerPostAlarm({
              postId: post.id, postName: post.name,
              absenceSeconds: absenceSec, thresholdSeconds: threshold,
              lastGuardId: post.last_guard_id, lastGuardName: post.last_guard_name,
              lastCameraId: post.last_camera_id,
            })
          }
          continue
        }

        // Verifica justificativa ativa
        const { rows: justifications } = await query(`
          SELECT id, duration_minutes, expires_at,
            GREATEST(0, EXTRACT(EPOCH FROM (expires_at - NOW()))::INTEGER) AS seconds_remaining
          FROM absence_justifications
          WHERE post_id = $1 AND status = 'active' AND expires_at > NOW()
          LIMIT 1
        `, [post.id])

        if (justifications.length > 0) {
          const remainSec = justifications[0].seconds_remaining
          await query(`
            INSERT INTO post_coverage_state (post_id, status, absence_seconds, updated_at)
            VALUES ($1, 'justified', $2, NOW())
            ON CONFLICT (post_id) DO UPDATE SET
              status = 'justified', absence_seconds = $2, updated_at = NOW()
          `, [post.id, remainSec])
          continue
        }

        // Verifica escala
        const { guards: activeGuards, mode } = await this._getActiveGuardsForPost(post.id)
        if (mode === 'schedule' && activeGuards.length === 0) {
          await query(`
            UPDATE post_coverage_state SET status = 'covered', absence_seconds = 0, updated_at = NOW()
            WHERE post_id = $1
          `, [post.id])
          continue
        }

        // Expira justificativas vencidas
        await query(`
          UPDATE absence_justifications SET status = 'expired'
          WHERE post_id = $1 AND status = 'active' AND expires_at <= NOW()
        `, [post.id])

        // Calcula ausência e status
        const now        = new Date()
        const lastSeen   = post.last_detected_at ? new Date(post.last_detected_at) : null
        const absenceSec = lastSeen ? Math.floor((now - lastSeen) / 1000) : 99999
        const threshold  = post.absence_threshold_seconds || 60
        const warning    = post.warning_threshold_seconds || 30

        let newStatus = 'covered'
        if (absenceSec >= threshold) newStatus = 'alarm'
        else if (absenceSec >= warning) newStatus = 'warning'

        await query(`
          INSERT INTO post_coverage_state (post_id, status, absence_seconds, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (post_id) DO UPDATE SET
            status = EXCLUDED.status, absence_seconds = EXCLUDED.absence_seconds, updated_at = NOW()
        `, [post.id, newStatus, absenceSec === 99999 ? null : absenceSec])

        if (newStatus === 'alarm' && post.current_status !== 'alarm') {
          await alarmService.triggerPostAlarm({
            postId: post.id, postName: post.name,
            absenceSeconds: absenceSec, thresholdSeconds: threshold,
            lastGuardId: post.last_guard_id, lastGuardName: post.last_guard_name,
            lastCameraId: post.last_camera_id,
          })
        }
      }

      // Broadcast snapshot
      const snapshot = await this.getSnapshot()
      alarmService._broadcast({ type: 'SNAPSHOT_UPDATE', payload: snapshot })

    } catch (err) {
      console.error('[AbsenceEngine] Erro no recálculo:', err.message)
    }
  }

  async _initCoverageState() {
    await query(`
      INSERT INTO post_coverage_state (post_id, status)
      SELECT DISTINCT p.id, 'covered' FROM posts p WHERE p.is_active = TRUE
      ON CONFLICT (post_id) DO NOTHING
    `)
    console.log('[AbsenceEngine] post_coverage_state inicializado')
  }

  async getSnapshot() {
    const today = new Date().toISOString().split('T')[0]
    const now   = new Date()
    const hm    = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0')

    const { rows } = await query(`
      SELECT
        p.id AS post_id, p.name AS post_name, p.floor,
        p.absence_threshold_seconds, p.warning_threshold_seconds,
        pcs.status, pcs.absence_seconds, pcs.last_detected_at,
        pcs.last_guard_name, pcs.updated_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'guard_id', g.id, 'guard_name', g.name,
              'badge_number', g.badge_number, 'photo_url', g.photo_url,
              'last_detected_at', ab.last_detected_at,
              'status', ab.status, 'absence_minutes', ab.absence_minutes,
              'absence_seconds', EXTRACT(EPOCH FROM (NOW() - ab.last_detected_at))::INTEGER
            )
          ) FILTER (WHERE g.id IS NOT NULL),
          '[]'
        ) AS guards,
        al.id AS alarm_id, al.triggered_at AS alarm_triggered_at
      FROM posts p
      LEFT JOIN post_coverage_state pcs ON pcs.post_id = p.id
      LEFT JOIN alarms al ON al.post_id = p.id AND al.status IN ('active','snoozed')
      LEFT JOIN (
        SELECT DISTINCT ON (ss.post_id, ss.guard_id) ss.post_id, ss.guard_id
        FROM shift_schedules ss
        JOIN shift_types st ON st.id = ss.shift_type_id AND st.is_active = TRUE
        WHERE ss.date = $1 AND ss.status = 'active'
          AND (
            (st.start_time < st.end_time AND $2::time BETWEEN st.start_time AND st.end_time)
            OR
            (st.start_time > st.end_time AND ($2::time >= st.start_time OR $2::time <= st.end_time))
          )
      ) sa ON sa.post_id = p.id
      LEFT JOIN guards g ON g.id = sa.guard_id AND g.is_active = TRUE
      LEFT JOIN absence_state ab ON ab.guard_id = g.id AND ab.post_id = p.id
      WHERE p.is_active = TRUE
      GROUP BY p.id, p.name, p.floor, p.absence_threshold_seconds, p.warning_threshold_seconds,
               pcs.status, pcs.absence_seconds, pcs.last_detected_at, pcs.last_guard_name,
               pcs.updated_at, al.id, al.triggered_at
      ORDER BY p.name ASC
    `, [today, hm])
    return rows
  }
}

module.exports = new AbsenceEngine()
