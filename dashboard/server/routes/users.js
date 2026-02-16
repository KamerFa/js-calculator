import { Router } from 'express';
import pool from '../db.js';
import { getRandomAvatarUrl } from '../avatars.js';

const router = Router();

// ── GET all users with stats ─────────────────────────────────
router.get('/', async (req, res) => {
  try {
    // First, assign random avatars to users who don't have one
    const { rows: noAvatar } = await pool.query(
      `SELECT id FROM users WHERE avatar_url IS NULL OR avatar_url = ''`
    );
    for (const u of noAvatar) {
      await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [getRandomAvatarUrl(), u.id]);
    }

    const { rows: users } = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, u.created_at,
              (SELECT COUNT(*) FROM tasks WHERE user_id = u.id AND status = 'done') as tasks_completed,
              (SELECT COUNT(*) FROM projects WHERE user_id = u.id) as projects_owned
       FROM users u
       ORDER BY u.created_at DESC`
    );

    res.json(users.map(u => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatar_url,
      memberSince: u.created_at,
      tasksCompleted: parseInt(u.tasks_completed),
      projectsOwned: parseInt(u.projects_owned)
    })));
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
