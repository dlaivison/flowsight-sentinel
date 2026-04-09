const router = require('express').Router()
const { query } = require('../db')
const { authenticate } = require('./auth.middleware')
const alarmService   = require('../services/alarm.service')
const absenceEngine  = require('../services/absence.engine')

router.use(authenticate)

// ─── MOTIVOS ─────────────────────────────────────────────────────────────────

router.get('/reasons', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT * FROM absence_reasons
      WHERE is_active = TRUE ORDER BY default_minutes
    `)
    res.json(rows)
  } catch (err) { next(err) }
})

router.post('/reasons', async (req, res, next) => {
  try {
    const { name, type, default_minutes } = req.body
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' })
    const { rows } = await query(`
      INSERT INTO absence_reasons (name, type, default_minutes)
      VALUES ($1, $2, $3) RETURNING *
    `, [name, type || 'both', default_minutes || 15])
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
})

router.put('/reasons/:id', async (req, res, next) => {
  try {
    const { name, type, default_minutes, is_active } = req.body
    const { rows } = await query(`
      UPDATE absence_reasons SET
        name            = COALESCE($1, name),
        type            = COALESCE($2, type),
        default_minutes = COALESCE($3, default_minutes),
        is_active       = COALESCE($4, is_active)
      WHERE id = $5 RETURNING *
    `, [name, type, default_minutes, is_active, req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Motivo não encontrado' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

router.delete('/reasons/:id', async (req, res, next) => {
  try {
    await query(`UPDATE absence_reasons SET is_active = FALSE WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ─── JUSTIFICATIVAS ──────────────────────────────────────────────────────────

// Lista justificativas ativas de um posto
router.get('/post/:postId', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        aj.*,
        ar.name   AS reason_name,
        ar.type   AS reason_type,
        g.name    AS guard_name,
        g.photo_url,
        EXTRACT(EPOCH FROM (aj.expires_at - NOW()))::INTEGER AS seconds_remaining
      FROM absence_justifications aj
      LEFT JOIN absence_reasons ar ON ar.id = aj.reason_id
      LEFT JOIN guards g            ON g.id = aj.guard_id
      WHERE aj.post_id = $1
        AND aj.status = 'active'
        AND aj.expires_at > NOW()
      ORDER BY aj.started_at DESC
    `, [req.params.postId])
    res.json(rows)
  } catch (err) { next(err) }
})

// Lista todas as justificativas ativas (para o motor)
router.get('/active', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        aj.*,
        ar.name  AS reason_name,
        ar.type  AS reason_type,
        EXTRACT(EPOCH FROM (aj.expires_at - NOW()))::INTEGER AS seconds_remaining
      FROM absence_justifications aj
      LEFT JOIN absence_reasons ar ON ar.id = aj.reason_id
      WHERE aj.status = 'active' AND aj.expires_at > NOW()
    `)
    res.json(rows)
  } catch (err) { next(err) }
})

// Cria nova justificativa
router.post('/', async (req, res, next) => {
  try {
    const { post_id, guard_id, reason_id, custom_reason, duration_minutes } = req.body
    if (!post_id) return res.status(400).json({ error: 'post_id é obrigatório' })
    if (!duration_minutes || duration_minutes < 1) {
      return res.status(400).json({ error: 'Duração inválida' })
    }

    const expires_at = new Date(Date.now() + duration_minutes * 60 * 1000)

    const { rows } = await query(`
      INSERT INTO absence_justifications
        (post_id, guard_id, reason_id, custom_reason, duration_minutes, expires_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [post_id, guard_id || null, reason_id || null, custom_reason || null,
        duration_minutes, expires_at, req.user?.username || 'admin'])

    // Atualiza status do posto para 'justified'
    await query(`
      UPDATE post_coverage_state SET status = 'justified', updated_at = NOW()
      WHERE post_id = $1
    `, [post_id])

    // Resolve alarme ativo do posto se houver
    await query(`
      UPDATE alarms SET status = 'auto_resolved', acknowledged_at = NOW()
      WHERE post_id = $1 AND status IN ('active', 'snoozed')
    `, [post_id])

    // Força recálculo imediato e broadcast
    setTimeout(async () => {
      try {
        await absenceEngine._recalculateAllPosts()
      } catch(_) {}
    }, 500)

    res.status(201).json(rows[0])
  } catch (err) { next(err) }
})

// Resolve justificativa manualmente (vigilante voltou)
router.post('/:id/resolve', async (req, res, next) => {
  try {
    const { rows } = await query(`
      UPDATE absence_justifications SET
        status = 'resolved', resolved_at = NOW()
      WHERE id = $1 RETURNING *
    `, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Justificativa não encontrada' })

    // Força recálculo imediato
    setTimeout(async () => {
      try { await absenceEngine._recalculateAllPosts() } catch(_) {}
    }, 500)

    res.json(rows[0])
  } catch (err) { next(err) }
})

// Expira justificativas vencidas (chamado pelo motor)
router.post('/expire', async (req, res, next) => {
  try {
    const { rows } = await query(`
      UPDATE absence_justifications SET status = 'expired'
      WHERE status = 'active' AND expires_at <= NOW()
      RETURNING post_id
    `)
    res.json({ expired: rows.length, posts: rows.map(r => r.post_id) })
  } catch (err) { next(err) }
})

module.exports = router
