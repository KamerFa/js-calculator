import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool, { uid } from '../db.js';
import { signToken, authMiddleware } from '../auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const { rows: existing } = await pool.query(
    'SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]
  );
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const hash = await bcrypt.hash(password, 10);
  const id = uid();
  await pool.query(
    'INSERT INTO users (id, username, password) VALUES ($1, $2, $3)',
    [id, username.trim(), hash]
  );

  const token = signToken(id);
  res.json({ token, user: { id, username: username.trim() } });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const { rows } = await pool.query(
    'SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]
  );
  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, username: user.username } });
});

router.get('/me', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, username, created_at FROM users WHERE id = $1', [req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: rows[0] });
});

export default router;
