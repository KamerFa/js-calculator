import { Router } from 'express';
import pool, { uid } from '../db.js';

const router = Router();

// ── POST: Start a focus session ────────────────────────────
router.post('/start', async (req, res) => {
  const { taskId, duration } = req.body;
  const id = uid();
  const dur = duration || 1500; // default 25 min
  const sessionDate = new Date().toISOString().split('T')[0];

  await pool.query(
    `INSERT INTO focus_sessions (id, user_id, task_id, duration, session_date)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, req.userId, taskId || null, dur, sessionDate]
  );

  res.json({ id, taskId: taskId || null, duration: dur, startedAt: new Date().toISOString(), sessionDate });
});

// ── POST: Complete a focus session ─────────────────────────
router.post('/:id/complete', async (req, res) => {
  await pool.query(
    `UPDATE focus_sessions SET completed_at = NOW() WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.userId]
  );
  res.json({ ok: true });
});

// ── DELETE: Cancel / discard a focus session ────────────────
router.delete('/:id', async (req, res) => {
  await pool.query(
    `DELETE FROM focus_sessions WHERE id = $1 AND user_id = $2 AND completed_at IS NULL`,
    [req.params.id, req.userId]
  );
  res.json({ ok: true });
});

// ── GET: Today's focus stats ───────────────────────────────
router.get('/today', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const { rows } = await pool.query(
    `SELECT COUNT(*) AS sessions, COALESCE(SUM(duration), 0) AS total_seconds
     FROM focus_sessions
     WHERE user_id = $1 AND session_date = $2 AND completed_at IS NOT NULL`,
    [req.userId, today]
  );

  res.json({
    sessions: parseInt(rows[0].sessions),
    totalSeconds: parseInt(rows[0].total_seconds),
  });
});

// ── GET: Focus stats for a specific task ───────────────────
router.get('/task/:taskId', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS sessions, COALESCE(SUM(duration), 0) AS total_seconds
     FROM focus_sessions
     WHERE user_id = $1 AND task_id = $2 AND completed_at IS NOT NULL`,
    [req.userId, req.params.taskId]
  );

  res.json({
    sessions: parseInt(rows[0].sessions),
    totalSeconds: parseInt(rows[0].total_seconds),
  });
});

// ── GET: Weekly focus history (last 7 days) ────────────────
router.get('/history', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT session_date, COUNT(*) AS sessions, SUM(duration) AS total_seconds
     FROM focus_sessions
     WHERE user_id = $1 AND completed_at IS NOT NULL
       AND session_date >= (CURRENT_DATE - INTERVAL '6 days')::text
     GROUP BY session_date
     ORDER BY session_date`,
    [req.userId]
  );

  res.json(rows.map((r) => ({
    date: r.session_date,
    sessions: parseInt(r.sessions),
    totalSeconds: parseInt(r.total_seconds),
  })));
});

export default router;
