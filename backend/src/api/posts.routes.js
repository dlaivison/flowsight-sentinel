const router = require('express').Router();
const { query } = require('../db');
const { authenticate } = require('./auth.middleware');

router.use(authenticate);

// Lista todos os postos com câmeras e vigilantes
router.get('/', async (req, res, next) => {
  try {
    const { rows: posts } = await query(`
      SELECT p.*,
             COUNT(DISTINCT pc.camera_id) AS camera_count,
             COUNT(DISTINCT gpa.guard_id) AS guard_count
      FROM posts p
      LEFT JOIN post_cameras pc ON pc.post_id = p.id
      LEFT JOIN guard_post_assignments gpa ON gpa.post_id = p.id AND gpa.removed_at IS NULL
      GROUP BY p.id ORDER BY p.floor, p.name
    `);
    for (const post of posts) {
      const { rows: cameras } = await query(`
        SELECT c.* FROM cameras c
        JOIN post_cameras pc ON pc.camera_id = c.id
        WHERE pc.post_id = $1 ORDER BY c.name`, [post.id]);

      // Busca todos os vigilantes ativos no posto com status atual
      const { rows: guards } = await query(`
        SELECT g.*, gpa.assigned_at,
               a.status, a.absence_minutes, a.last_detected_at
        FROM guards g
        JOIN guard_post_assignments gpa ON gpa.guard_id = g.id
        LEFT JOIN absence_state a ON a.guard_id = g.id
        WHERE gpa.post_id = $1 AND gpa.removed_at IS NULL
        ORDER BY gpa.assigned_at ASC`, [post.id]);

      post.cameras = cameras;
      post.guards  = guards;
    }
    res.json(posts);
  } catch (err) { next(err); }
});

// Cria novo posto
router.post('/', async (req, res, next) => {
  try {
    const { name, description, floor, absence_threshold_minutes, warning_threshold_minutes, camera_ids } = req.body;
    const { rows } = await query(`
      INSERT INTO posts (name, description, floor, absence_threshold_minutes, warning_threshold_minutes)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [name, description, floor, absence_threshold_minutes || 30, warning_threshold_minutes || 20]);
    const post = rows[0];
    if (camera_ids?.length) {
      for (const cameraId of camera_ids) {
        await query(
          `INSERT INTO post_cameras (post_id, camera_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [post.id, cameraId]
        );
      }
    }
    res.status(201).json(post);
  } catch (err) { next(err); }
});

// Atualiza posto
router.put('/:id', async (req, res, next) => {
  try {
    const { name, description, floor, absence_threshold_minutes, warning_threshold_minutes, camera_ids, is_active } = req.body;
    const { rows } = await query(`
      UPDATE posts SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        floor = COALESCE($3, floor),
        absence_threshold_minutes = COALESCE($4, absence_threshold_minutes),
        warning_threshold_minutes = COALESCE($5, warning_threshold_minutes),
        is_active = COALESCE($6, is_active),
        updated_at = NOW()
      WHERE id = $7 RETURNING *
    `, [name, description, floor, absence_threshold_minutes, warning_threshold_minutes, is_active, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Posto não encontrado' });
    if (camera_ids) {
      await query('DELETE FROM post_cameras WHERE post_id = $1', [req.params.id]);
      for (const cameraId of camera_ids) {
        await query('INSERT INTO post_cameras (post_id, camera_id) VALUES ($1, $2)', [req.params.id, cameraId]);
      }
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Atribui vigilante ao posto
// Lógica: um vigilante só pode estar ativo em 1 posto por vez
//         mas um posto pode ter N vigilantes ativos simultaneamente
router.post('/:id/assign-guard', async (req, res, next) => {
  try {
    const { guard_id } = req.body;
    const post_id = req.params.id;

    // Verifica se vigilante já está neste posto
    const { rows: existing } = await query(`
      SELECT id FROM guard_post_assignments
      WHERE guard_id = $1 AND post_id = $2 AND removed_at IS NULL
    `, [guard_id, post_id]);

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Vigilante já está neste posto' });
    }

    // Encerra atribuições do vigilante em OUTROS postos (não neste)
    await query(`
      UPDATE guard_post_assignments
      SET removed_at = NOW()
      WHERE guard_id = $1 AND post_id != $2 AND removed_at IS NULL
    `, [guard_id, post_id]);

    // Cria nova atribuição neste posto
    const { rows } = await query(`
      INSERT INTO guard_post_assignments (guard_id, post_id, assigned_by)
      VALUES ($1, $2, $3) RETURNING *
    `, [guard_id, post_id, req.user?.username || 'system']);

    // Inicializa/atualiza absence_state
    await query(`
      INSERT INTO absence_state (guard_id, post_id, status, absence_minutes)
      VALUES ($1, $2, 'present', 0)
      ON CONFLICT (guard_id) DO UPDATE SET
        post_id = EXCLUDED.post_id,
        absence_minutes = 0,
        status = 'present',
        last_detected_at = NULL,
        updated_at = NOW()
    `, [guard_id, post_id]);

    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Remove vigilante do posto
router.post('/:id/remove-guard', async (req, res, next) => {
  try {
    const { guard_id } = req.body;
    const post_id = req.params.id;

    await query(`
      UPDATE guard_post_assignments
      SET removed_at = NOW()
      WHERE guard_id = $1 AND post_id = $2 AND removed_at IS NULL
    `, [guard_id, post_id]);

    // Limpa absence_state do vigilante
    await query(`
      UPDATE absence_state SET
        post_id = NULL, status = 'present',
        absence_minutes = 0, updated_at = NOW()
      WHERE guard_id = $1
    `, [guard_id]);

    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
