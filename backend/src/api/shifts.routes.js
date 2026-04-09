const router = require('express').Router()
const { query } = require('../db')
const { authenticate } = require('./auth.middleware')

router.use(authenticate)

// ─── SHIFT TYPES (configuração de turnos) ───────────────────────────────────

// Lista todos os tipos de turno
router.get('/types', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT * FROM shift_types ORDER BY start_time
    `)
    res.json(rows)
  } catch (err) { next(err) }
})

// Cria novo tipo de turno
router.post('/types', async (req, res, next) => {
  try {
    const { name, start_time, end_time, color } = req.body
    if (!name || !start_time || !end_time) {
      return res.status(400).json({ error: 'Nome, início e fim são obrigatórios' })
    }

    // Verifica sobreposição com turnos existentes
    const { rows: existing } = await query(`
      SELECT name FROM shift_types
      WHERE is_active = TRUE
        AND NOT (end_time <= $1 OR start_time >= $2)
        AND NOT (start_time = end_time)  -- turno vira-noite (ex: 18-06)
    `, [start_time, end_time])

    // Para turnos que viram meia-noite, verificação especial
    // Por enquanto apenas avisa, não bloqueia
    const { rows } = await query(`
      INSERT INTO shift_types (name, start_time, end_time, color)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [name, start_time, end_time, color || '#58A6FF'])

    res.status(201).json(rows[0])
  } catch (err) { next(err) }
})

// Atualiza tipo de turno
router.put('/types/:id', async (req, res, next) => {
  try {
    const { name, start_time, end_time, color, is_active } = req.body
    const { rows } = await query(`
      UPDATE shift_types SET
        name       = COALESCE($1, name),
        start_time = COALESCE($2, start_time),
        end_time   = COALESCE($3, end_time),
        color      = COALESCE($4, color),
        is_active  = COALESCE($5, is_active),
        updated_at = NOW()
      WHERE id = $6 RETURNING *
    `, [name, start_time, end_time, color, is_active, req.params.id])

    if (!rows[0]) return res.status(404).json({ error: 'Turno não encontrado' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

// Remove tipo de turno
router.delete('/types/:id', async (req, res, next) => {
  try {
    // Verifica se tem escalas futuras vinculadas
    const { rows: scheduled } = await query(`
      SELECT COUNT(*) as count FROM shift_schedules
      WHERE shift_type_id = $1 AND date >= CURRENT_DATE
    `, [req.params.id])

    if (parseInt(scheduled[0].count) > 0) {
      return res.status(400).json({
        error: 'Turno possui escalas futuras — remova-as antes de excluir'
      })
    }

    await query(`DELETE FROM shift_types WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  } catch (err) { next(err) }
})

// Retorna o turno atualmente ativo pelo horário
router.get('/active', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT * FROM shift_types
      WHERE is_active = TRUE
        AND (
          -- Turno normal (ex: 06:00-18:00)
          (start_time < end_time AND CURRENT_TIME BETWEEN start_time AND end_time)
          OR
          -- Turno vira-noite (ex: 18:00-06:00)
          (start_time > end_time AND (CURRENT_TIME >= start_time OR CURRENT_TIME <= end_time))
        )
      LIMIT 1
    `)
    res.json(rows[0] || null)
  } catch (err) { next(err) }
})

// ─── SHIFT SCHEDULES (escala diária) ────────────────────────────────────────

// Lista escala de uma data (default: hoje)
router.get('/schedule', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0]

    // Busca todos os turnos do dia com seus vigilantes escalados
    const { rows: shiftTypes } = await query(`
      SELECT * FROM shift_types WHERE is_active = TRUE ORDER BY start_time
    `)

    const result = []

    for (const shift of shiftTypes) {
      // Vigilantes escalados para este turno nesta data
      const { rows: scheduled } = await query(`
        SELECT
          ss.*,
          g.name        AS guard_name,
          g.photo_url,
          g.badge_number,
          g.forsight_poi_id,
          p.name        AS post_name,
          p.floor
        FROM shift_schedules ss
        JOIN guards g ON g.id = ss.guard_id
        LEFT JOIN posts p ON p.id = ss.post_id
        WHERE ss.shift_type_id = $1 AND ss.date = $2
        ORDER BY g.name
      `, [shift.id, date])

      // Vigilantes ainda não escalados neste turno
      const { rows: unscheduled } = await query(`
        SELECT g.id, g.name, g.photo_url, g.badge_number, g.forsight_poi_id
        FROM guards g
        WHERE g.is_active = TRUE
          AND g.id NOT IN (
            SELECT guard_id FROM shift_schedules
            WHERE shift_type_id = $1 AND date = $2
          )
        ORDER BY g.name
      `, [shift.id, date])

      result.push({
        ...shift,
        scheduled,
        unscheduled,
        is_current: false, // calculado abaixo
      })
    }

    // Marca o turno atual
    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    result.forEach(shift => {
      const start = shift.start_time.slice(0,5)
      const end   = shift.end_time.slice(0,5)
      if (start < end) {
        shift.is_current = currentTime >= start && currentTime <= end
      } else {
        shift.is_current = currentTime >= start || currentTime <= end
      }
    })

    res.json({ date, shifts: result })
  } catch (err) { next(err) }
})

// Adiciona ou atualiza vigilante na escala
router.post('/schedule', async (req, res, next) => {
  try {
    const { shift_type_id, guard_id, post_id, date, status, notes } = req.body
    if (!shift_type_id || !guard_id) {
      return res.status(400).json({ error: 'shift_type_id e guard_id são obrigatórios' })
    }

    const scheduleDate = date || new Date().toISOString().split('T')[0]

    const { rows } = await query(`
      INSERT INTO shift_schedules
        (shift_type_id, guard_id, post_id, date, status, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (shift_type_id, guard_id, date) DO UPDATE SET
        post_id    = EXCLUDED.post_id,
        status     = EXCLUDED.status,
        notes      = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *
    `, [shift_type_id, guard_id, post_id || null, scheduleDate,
        status || 'active', notes || null, req.user?.username || 'system'])

    res.status(201).json(rows[0])
  } catch (err) { next(err) }
})

// Remove vigilante da escala
router.delete('/schedule/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM shift_schedules WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  } catch (err) { next(err) }
})

// Retorna vigilantes ativos no turno atual (usado pelo motor de ausências)
router.get('/active-guards', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { rows } = await query(`
      SELECT
        ss.guard_id,
        ss.post_id,
        ss.status,
        g.name          AS guard_name,
        g.forsight_poi_id,
        g.photo_url,
        g.badge_number,
        p.name          AS post_name,
        st.name         AS shift_name,
        st.start_time,
        st.end_time
      FROM shift_schedules ss
      JOIN guards g       ON g.id = ss.guard_id
      JOIN shift_types st ON st.id = ss.shift_type_id
      LEFT JOIN posts p   ON p.id = ss.post_id
      WHERE ss.date = $1
        AND ss.status = 'active'
        AND st.is_active = TRUE
        AND (
          (st.start_time < st.end_time AND CURRENT_TIME BETWEEN st.start_time AND st.end_time)
          OR
          (st.start_time > st.end_time AND (CURRENT_TIME >= st.start_time OR CURRENT_TIME <= st.end_time))
        )
      ORDER BY g.name
    `, [today])

    res.json(rows)
  } catch (err) { next(err) }
})

module.exports = router
