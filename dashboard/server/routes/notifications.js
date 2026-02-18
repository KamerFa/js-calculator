import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// ── GET notifications for current user ─────────────────────
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT n.*, u.username AS actor_name, u.avatar_url AS actor_avatar
     FROM notifications n
     LEFT JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT 50`,
    [req.userId]
  );
  res.json(rows.map((r) => ({
    id: r.id,
    type: r.type,
    summary: r.summary,
    targetType: r.target_type,
    targetId: r.target_id,
    actorName: r.actor_name,
    actorAvatar: r.actor_avatar,
    isRead: r.is_read,
    createdAt: r.created_at,
  })));
});

// ── GET unread count ───────────────────────────────────────
router.get('/unread-count', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
    [req.userId]
  );
  res.json({ count: parseInt(rows[0].count) });
});

// ── GET notification preferences ───────────────────────────
router.get('/preferences', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT notification_preferences FROM users WHERE id = $1',
    [req.userId]
  );
  const prefs = JSON.parse(rows[0]?.notification_preferences || '{}');
  res.json(prefs);
});

// ── PUT update notification preferences ────────────────────
router.put('/preferences', async (req, res) => {
  const prefs = JSON.stringify(req.body || {});
  await pool.query(
    'UPDATE users SET notification_preferences = $1 WHERE id = $2',
    [prefs, req.userId]
  );
  res.json({ ok: true });
});

// ── PUT mark one as read ───────────────────────────────────
router.put('/:id/read', async (req, res) => {
  await pool.query(
    `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.userId]
  );
  res.json({ ok: true });
});

// ── PUT mark all as read ───────────────────────────────────
router.put('/read-all', async (req, res) => {
  await pool.query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [req.userId]
  );
  res.json({ ok: true });
});

// ── DELETE individual notification ─────────────────────────
router.delete('/:id', async (req, res) => {
  await pool.query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.userId]
  );
  res.json({ ok: true });
});

export default router;
