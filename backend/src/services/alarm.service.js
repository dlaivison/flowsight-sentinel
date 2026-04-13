const { query } = require('../db')

class AlarmService {
  constructor() {
    this.wsServer = null
  }

  setWebSocketServer(wss) {
    this.wsServer = wss
  }

  // Novo: alarme por posto (quando posto fica descoberto)
  async triggerPostAlarm({ postId, postName, absenceSeconds, thresholdSeconds, lastGuardId, lastGuardName, lastCameraId }) {
    // Verifica se já há alarme ativo para este posto
    const { rows: existing } = await query(`
      SELECT id FROM alarms
      WHERE post_id = $1 AND guard_id IS NULL AND status IN ('active', 'snoozed')
      LIMIT 1
    `, [postId])

    if (existing.length > 0) return null

    const absenceMinutes = Math.floor(absenceSeconds / 60)

    const { rows } = await query(`
      INSERT INTO alarms
        (post_id, guard_id, absence_minutes, threshold_minutes, status)
      VALUES ($1, NULL, $2, $3, 'active')
      RETURNING *
    `, [postId, absenceMinutes, Math.floor(thresholdSeconds / 60)])

    const alarm = rows[0]
    console.log(`[AlarmService] 🚨 Posto descoberto: ${postName} — ${absenceSeconds}s sem vigilante`)

    const alarmData = await this._getPostAlarmDetails(alarm.id, postId, lastGuardName)
    this._broadcast({ type: 'ALARM_TRIGGERED', payload: alarmData })
    return alarm
  }

  // Legado: alarme por vigilante (mantido para compatibilidade)
  async triggerAlarm({ guardId, postId, absenceMinutes, thresholdMinutes, frameImageUrl }) {
    const { rows: existing } = await query(`
      SELECT id FROM alarms
      WHERE guard_id = $1 AND status IN ('active', 'snoozed')
      LIMIT 1
    `, [guardId])

    if (existing.length > 0) return null

    const { rows } = await query(`
      INSERT INTO alarms (guard_id, post_id, absence_minutes, threshold_minutes, frame_image_url, status)
      VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *
    `, [guardId, postId, absenceMinutes, thresholdMinutes, frameImageUrl])

    const alarm = rows[0]
    const alarmData = await this._getAlarmWithDetails(alarm.id)
    this._broadcast({ type: 'ALARM_TRIGGERED', payload: alarmData })
    return alarm
  }

  async acknowledge(alarmId, acknowledgedBy, notes = '') {
    const { rows } = await query(`
      UPDATE alarms SET
        status          = 'acknowledged',
        acknowledged_at = NOW(),
        acknowledged_by = $2,
        notes           = $3
      WHERE id = $1 RETURNING *
    `, [alarmId, acknowledgedBy, notes])

    if (rows[0]) {
      this._broadcast({ type: 'ALARM_ACKNOWLEDGED', payload: { alarmId, acknowledgedBy } })
    }
    return rows[0] || null
  }

  async snooze(alarmId, minutes = 10) {
    const until = new Date(Date.now() + minutes * 60 * 1000)
    const { rows } = await query(`
      UPDATE alarms SET status = 'snoozed', snoozed_until = $2
      WHERE id = $1 RETURNING *
    `, [alarmId, until])

    if (rows[0]) {
      this._broadcast({ type: 'ALARM_SNOOZED', payload: { alarmId, until } })
    }
    return rows[0] || null
  }

  async getActiveAlarms() {
    const { rows } = await query(`
      SELECT al.*,
             p.name AS post_name, p.floor,
             g.name AS guard_name, g.photo_url AS guard_photo_url, g.badge_number
      FROM alarms al
      JOIN posts p ON p.id = al.post_id
      LEFT JOIN guards g ON g.id = al.guard_id
      WHERE al.status IN ('active', 'snoozed')
        AND (al.snoozed_until IS NULL OR al.snoozed_until < NOW())
      ORDER BY al.triggered_at DESC
    `)
    return rows
  }

  async getHistory({ guardId, postId, from, to, status, limit = 50, offset = 0 } = {}) {
    let where = ['1=1']
    const params = []
    let i = 1
    if (guardId) { where.push(`al.guard_id = $${i++}`); params.push(guardId) }
    if (postId)  { where.push(`al.post_id  = $${i++}`); params.push(postId)  }
    if (status)  { where.push(`al.status   = $${i++}`); params.push(status)  }
    if (from)    { where.push(`al.triggered_at >= $${i++}`); params.push(from) }
    if (to)      { where.push(`al.triggered_at <= $${i++}`); params.push(to)   }
    params.push(limit, offset)

    const { rows } = await query(`
      SELECT al.*,
             p.name AS post_name, p.floor,
             g.name AS guard_name, g.badge_number
      FROM alarms al
      JOIN posts p ON p.id = al.post_id
      LEFT JOIN guards g ON g.id = al.guard_id
      WHERE ${where.join(' AND ')}
      ORDER BY al.triggered_at DESC
      LIMIT $${i} OFFSET $${i+1}
    `, params)
    return rows
  }

  _broadcast(message) {
    if (!this.wsServer) return
    const data = JSON.stringify(message)
    this.wsServer.clients.forEach(client => {
      if (client.readyState === 1) client.send(data)
    })
  }

  async _getPostAlarmDetails(alarmId, postId, lastGuardName) {
    const { rows } = await query(`
      SELECT al.*, p.name AS post_name, p.floor,
             p.absence_threshold_seconds, p.warning_threshold_seconds
      FROM alarms al
      JOIN posts p ON p.id = al.post_id
      WHERE al.id = $1
    `, [alarmId])
    const alarm = rows[0] || {}
    alarm.last_guard_name = lastGuardName
    return alarm
  }

  async _getAlarmWithDetails(alarmId) {
    const { rows } = await query(`
      SELECT al.*, g.name AS guard_name, g.photo_url AS guard_photo_url,
             g.badge_number, g.fortify_poi_id,
             p.name AS post_name, p.floor, p.absence_threshold_seconds
      FROM alarms al
      JOIN posts p ON p.id = al.post_id
      LEFT JOIN guards g ON g.id = al.guard_id
      WHERE al.id = $1
    `, [alarmId])
    return rows[0] || null
  }
}

module.exports = new AlarmService()
