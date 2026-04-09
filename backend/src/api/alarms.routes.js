const router = require('express').Router();
const { authenticate } = require('./auth.middleware');
const alarmSvc = require('../services/alarm.service');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { guardId, postId, from, to, limit, offset } = req.query;
    const rows = await alarmSvc.getHistory({ guardId, postId, from, to,
      limit: parseInt(limit) || 50, offset: parseInt(offset) || 0 });
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/active', async (req, res, next) => {
  try { res.json(await alarmSvc.getActiveAlarms()); }
  catch (err) { next(err); }
});

router.post('/:id/acknowledge', async (req, res, next) => {
  try {
    const alarm = await alarmSvc.acknowledge(req.params.id, req.user.username, req.body.notes);
    if (!alarm) return res.status(404).json({ error: 'Alarme não encontrado' });
    res.json(alarm);
  } catch (err) { next(err); }
});

router.post('/:id/snooze', async (req, res, next) => {
  try {
    const { minutes = 10 } = req.body;
    const alarm = await alarmSvc.snooze(req.params.id, parseInt(minutes));
    if (!alarm) return res.status(404).json({ error: 'Alarme não encontrado' });
    res.json(alarm);
  } catch (err) { next(err); }
});

module.exports = router;
