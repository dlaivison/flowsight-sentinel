const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireAdmin } = require('./auth.middleware');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM system_config ORDER BY key');
    res.json(rows);
  } catch (err) { next(err); }
});

router.put('/:key', requireAdmin, async (req, res, next) => {
  try {
    const { value } = req.body;
    const { rows } = await query(`
      UPDATE system_config SET value = $1, updated_at = NOW()
      WHERE key = $2 RETURNING *
    `, [value, req.params.key]);
    if (!rows[0]) return res.status(404).json({ error: 'Configuração não encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
