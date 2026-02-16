import { Router } from 'express';
import pool, { uid } from '../db.js';

const router = Router();

// ── GET community feed (all tweets, newest first) ─────────
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.*, u.username
     FROM tweets t
     JOIN users u ON u.id = t.user_id
     ORDER BY t.created_at DESC
     LIMIT 200`
  );
  res.json(rows.map((r) => ({
    id: r.id,
    body: r.body,
    username: r.username,
    userId: r.user_id,
    createdAt: r.created_at,
  })));
});

// ── POST new tweet ────────────────────────────────────────
router.post('/', async (req, res) => {
  const { body } = req.body;
  if (!body?.trim() || body.trim().length > 280) {
    return res.status(400).json({ error: 'Tweet must be 1-280 characters' });
  }
  const id = uid();
  await pool.query(
    'INSERT INTO tweets (id, user_id, body) VALUES ($1, $2, $3)',
    [id, req.userId, body.trim()]
  );
  const { rows } = await pool.query(
    `SELECT t.*, u.username FROM tweets t JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
    [id]
  );
  res.json({
    id: rows[0].id,
    body: rows[0].body,
    username: rows[0].username,
    userId: rows[0].user_id,
    createdAt: rows[0].created_at,
  });
});

// ── DELETE own tweet ──────────────────────────────────────
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM tweets WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
});

export default router;
