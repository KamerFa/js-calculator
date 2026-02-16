import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { uid } from '../db.js';
import { signToken, authMiddleware } from '../auth.js';

const router = Router();

const findUser = db.prepare('SELECT * FROM users WHERE username = ?');
const insertUser = db.prepare(
  'INSERT INTO users (id, username, password) VALUES (?, ?, ?)'
);

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const existing = findUser.get(username.trim());
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const hash = await bcrypt.hash(password, 10);
  const id = uid();
  insertUser.run(id, username.trim(), hash);

  const token = signToken(id);
  res.json({ token, user: { id, username: username.trim() } });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = findUser.get(username.trim());
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

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

export default router;
