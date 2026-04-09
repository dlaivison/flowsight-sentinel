const router = require('express').Router();
const { query } = require('../db');
const { authenticate } = require('./auth.middleware');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT g.*, aa.post_id, aa.post_name, aa.floor, aa.assigned_at,
             ab.status, ab.absence_minutes, ab.last_detected_at
      FROM guards g
      LEFT JOIN active_assignments aa ON aa.guard_id = g.id
      LEFT JOIN absence_state ab ON ab.guard_id = g.id
      WHERE g.is_active = TRUE ORDER BY g.name
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { forsight_poi_id, name, badge_number, photo_url, group_name } = req.body;
    const { rows } = await query(`
      INSERT INTO guards (forsight_poi_id, name, badge_number, photo_url, group_name)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [forsight_poi_id, name, badge_number, photo_url, group_name]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, badge_number, photo_url, group_name, is_active } = req.body;
    const { rows } = await query(`
      UPDATE guards SET
        name = COALESCE($1, name), badge_number = COALESCE($2, badge_number),
        photo_url = COALESCE($3, photo_url), group_name = COALESCE($4, group_name),
        is_active = COALESCE($5, is_active)
      WHERE id = $6 RETURNING *
    `, [name, badge_number, photo_url, group_name, is_active, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Vigilante não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
