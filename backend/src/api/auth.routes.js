const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const { query } = require('../db');
const SECRET = process.env.JWT_SECRET || 'flowsight_dev_secret';

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Credenciais obrigatórias' });

    const { rows } = await query('SELECT * FROM users WHERE username = $1 AND is_active = TRUE', [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Usuário ou senha incorretos' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Usuário ou senha incorretos' });

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.full_name },
      SECRET, { expiresIn: '12h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.full_name } });
  } catch (err) { next(err); }
});

module.exports = router;
