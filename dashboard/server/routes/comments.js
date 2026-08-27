import { Router } from 'express';
import pool, { uid } from '../db.js';

const router = Router();

// GET comments for a target (task, project, note)
router.get('/:targetType/:targetId', async (req, res) => {
  const { targetType, targetId } = req.params;
  if (!['task', 'project', 'note'].includes(targetType)) {
    return res.status(400).json({ error: 'Invalid target type' });
  }
  const { rows } = await pool.query(
    `SELECT c.*, u.username, u.avatar_url
     FROM item_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.target_type = $1 AND c.target_id = $2
     ORDER BY c.created_at ASC`,
    [targetType, targetId]
  );
  res.json(rows.map((r) => ({
    id: r.id, body: r.body, createdAt: r.created_at,
    userId: r.user_id, username: r.username, avatarUrl: r.avatar_url,
  })));
});

// POST a comment
router.post('/:targetType/:targetId', async (req, res) => {
  const { targetType, targetId } = req.params;
  const { body } = req.body;
  if (!['task', 'project', 'note'].includes(targetType)) {
    return res.status(400).json({ error: 'Invalid target type' });
  }
  if (!body?.trim()) return res.status(400).json({ error: 'Body required' });

  const id = uid();
  await pool.query(
    'INSERT INTO item_comments (id, target_type, target_id, user_id, body) VALUES ($1, $2, $3, $4, $5)',
    [id, targetType, targetId, req.userId, body.trim().slice(0, 1000)]
  );
  const { rows } = await pool.query(
    `SELECT c.*, u.username, u.avatar_url
     FROM item_comments c JOIN users u ON u.id = c.user_id WHERE c.id = $1`, [id]
  );
  const r = rows[0];
  res.json({
    id: r.id, body: r.body, createdAt: r.created_at,
    userId: r.user_id, username: r.username, avatarUrl: r.avatar_url,
  });
});

// DELETE a comment (author only)
router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT user_id FROM item_comments WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  if (rows[0].user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  await pool.query('DELETE FROM item_comments WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
