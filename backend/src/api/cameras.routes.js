const router = require('express').Router();
const { query } = require('../db');
const { authenticate } = require('./auth.middleware');
const fortify = require('../services/fortify.service');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM cameras ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/sync', async (req, res, next) => {
  try {
    const count = await fortify.syncCameras();
    res.json({ synced: count });
  } catch (err) { next(err); }
});

module.exports = router;
