const router       = require('express').Router()
const { authenticate } = require('./auth.middleware')
const absenceEngine = require('../services/absence.engine')
const { query }    = require('../db')

router.use(authenticate)

// Snapshot do dashboard — postos com status de cobertura
router.get('/snapshot', async (req, res, next) => {
  try {
    const snapshot = await absenceEngine.getSnapshot()
    res.json(snapshot)
  } catch (err) { next(err) }
})

// Histórico de ausências de um vigilante específico
router.get('/guard/:guardId/history', async (req, res, next) => {
  try {
    const { guardId } = req.params
    const period = req.query.period || 'day'

    let groupBy, dateFilter
    if (period === 'month') {
      groupBy = "DATE_TRUNC('day', triggered_at)"
      dateFilter = "triggered_at >= DATE_TRUNC('month', NOW())"
    } else {
      groupBy = "DATE_TRUNC('hour', triggered_at)"
      dateFilter = "triggered_at >= DATE_TRUNC('day', NOW())"
    }

    const { rows } = await query(`
      SELECT
        ${groupBy} AS period,
        COUNT(*)   AS alarm_count,
        MAX(absence_minutes) AS max_absence_minutes
      FROM alarms
      WHERE guard_id = $1 AND ${dateFilter}
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `, [guardId])

    res.json(rows)
  } catch (err) { next(err) }
})

// Histórico de ausências de um posto específico
router.get('/post/:postId/history', async (req, res, next) => {
  try {
    const { postId } = req.params
    const period = req.query.period || 'day'

    let groupBy, dateFilter
    if (period === 'month') {
      groupBy = "DATE_TRUNC('day', triggered_at)"
      dateFilter = "triggered_at >= DATE_TRUNC('month', NOW())"
    } else {
      groupBy = "DATE_TRUNC('hour', triggered_at)"
      dateFilter = "triggered_at >= DATE_TRUNC('day', NOW())"
    }

    const { rows } = await query(`
      SELECT
        ${groupBy} AS period,
        COUNT(*)   AS alarm_count,
        MAX(absence_minutes) AS max_absence_minutes
      FROM alarms
      WHERE post_id = $1 AND ${dateFilter}
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `, [postId])

    res.json(rows)
  } catch (err) { next(err) }
})

module.exports = router
