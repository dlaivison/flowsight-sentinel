const router = require('express').Router()
const { query } = require('../db')
const { authenticate } = require('./auth.middleware')

router.use(authenticate)

router.get('/alarms', async (req, res, next) => {
  try {
    const { from, to, groupBy = 'post' } = req.query
    const dateFrom = from || new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]
    const dateTo   = to   || new Date().toISOString().split('T')[0]

    // Dados detalhados
    const { rows } = await query(`
      SELECT
        a.id, a.triggered_at, a.absence_minutes, a.threshold_minutes,
        a.status, a.acknowledged_at, a.acknowledged_by,
        p.name AS post_name, p.floor,
        g.name AS guard_name, g.badge_number
      FROM alarms a
      LEFT JOIN posts  p ON p.id = a.post_id
      LEFT JOIN guards g ON g.id = a.guard_id
      WHERE a.triggered_at::date BETWEEN $1 AND $2
      ORDER BY a.triggered_at DESC
    `, [dateFrom, dateTo])

    // Sumário
    const { rows: summary } = await query(`
      SELECT
        COUNT(*)                                           AS total,
        COUNT(CASE WHEN status='acknowledged'  THEN 1 END) AS acknowledged,
        COUNT(CASE WHEN status='auto_resolved' THEN 1 END) AS auto_resolved,
        AVG(absence_minutes * 60)::INTEGER                 AS avg_absence_seconds,
        MAX(absence_minutes * 60)                          AS max_absence_seconds
      FROM alarms
      WHERE triggered_at::date BETWEEN $1 AND $2
    `, [dateFrom, dateTo])

    // Posto mais crítico
    const { rows: topPost } = await query(`
      SELECT p.name, COUNT(*) as total
      FROM alarms a JOIN posts p ON p.id = a.post_id
      WHERE a.triggered_at::date BETWEEN $1 AND $2
      GROUP BY p.name ORDER BY total DESC LIMIT 1
    `, [dateFrom, dateTo])

    // Agrupamento
    let groups = []
    if (groupBy === 'post') {
      const { rows: g } = await query(`
        SELECT
          p.name, COUNT(*) AS total,
          COUNT(CASE WHEN a.status='acknowledged' THEN 1 END) AS acknowledged,
          AVG(a.absence_minutes*60)::INTEGER AS avg_seconds,
          MAX(a.absence_minutes*60)          AS max_seconds
        FROM alarms a JOIN posts p ON p.id = a.post_id
        WHERE a.triggered_at::date BETWEEN $1 AND $2
        GROUP BY p.name ORDER BY total DESC
      `, [dateFrom, dateTo])
      groups = g
    } else if (groupBy === 'guard') {
      const { rows: g } = await query(`
        SELECT
          COALESCE(g.name, 'Desconhecido') AS name,
          COUNT(*) AS total,
          COUNT(CASE WHEN a.status='acknowledged' THEN 1 END) AS acknowledged,
          AVG(a.absence_minutes*60)::INTEGER AS avg_seconds,
          MAX(a.absence_minutes*60)          AS max_seconds
        FROM alarms a LEFT JOIN guards g ON g.id = a.guard_id
        WHERE a.triggered_at::date BETWEEN $1 AND $2
        GROUP BY g.name ORDER BY total DESC
      `, [dateFrom, dateTo])
      groups = g
    } else if (groupBy === 'day') {
      const { rows: g } = await query(`
        SELECT
          TO_CHAR(triggered_at, 'DD/MM/YYYY') AS name,
          COUNT(*) AS total,
          COUNT(CASE WHEN status='acknowledged' THEN 1 END) AS acknowledged,
          AVG(absence_minutes*60)::INTEGER AS avg_seconds,
          MAX(absence_minutes*60)          AS max_seconds
        FROM alarms
        WHERE triggered_at::date BETWEEN $1 AND $2
        GROUP BY TO_CHAR(triggered_at, 'DD/MM/YYYY'), triggered_at::date
        ORDER BY triggered_at::date DESC
      `, [dateFrom, dateTo])
      groups = g
    }

    res.json({
      summary: {
        ...summary[0],
        top_post: topPost[0]?.name || '—',
      },
      groups,
      rows,
    })
  } catch (err) { next(err) }
})

module.exports = router
