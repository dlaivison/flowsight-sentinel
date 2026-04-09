const router = require('express').Router();
const { query } = require('../db');
const { authenticate } = require('./auth.middleware');
const forsight = require('../services/forsight.service');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM cameras ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/sync', async (req, res, next) => {
  try {
    const count = await forsight.syncCameras();
    res.json({ synced: count });
  } catch (err) { next(err); }
});

module.exports = router;
