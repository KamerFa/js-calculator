import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// ── GET own profile ──────────────────────────────────────────
router.get('/me', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, username, bio, avatar_url, music_service, music_username, created_at
     FROM users WHERE id = $1`,
    [req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  const u = rows[0];
  res.json({
    id: u.id, username: u.username, bio: u.bio || '',
    avatarUrl: u.avatar_url, musicService: u.music_service,
    musicUsername: u.music_username, createdAt: u.created_at,
  });
});

// ── GET public profile by username ───────────────────────────
router.get('/user/:username', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, username, bio, avatar_url, music_service, music_username, created_at
     FROM users WHERE LOWER(username) = LOWER($1)`,
    [req.params.username]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  const u = rows[0];
  res.json({
    id: u.id, username: u.username, bio: u.bio || '',
    avatarUrl: u.avatar_url, musicService: u.music_service,
    musicUsername: u.music_username, createdAt: u.created_at,
  });
});

// ── PUT update profile ───────────────────────────────────────
router.put('/me', async (req, res) => {
  const { bio, musicService, musicUsername } = req.body;
  await pool.query(
    `UPDATE users SET bio = $1, music_service = $2, music_username = $3 WHERE id = $4`,
    [
      (bio || '').slice(0, 300),
      musicService || null,
      musicUsername || null,
      req.userId,
    ]
  );
  res.json({ ok: true });
});

export default router;
