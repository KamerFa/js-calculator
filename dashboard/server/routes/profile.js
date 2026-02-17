import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// ── GET own profile ──────────────────────────────────────────
router.get('/me', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, username, bio, avatar_url, music_service, music_username, show_projects_on_profile, created_at
     FROM users WHERE id = $1`,
    [req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  const u = rows[0];
  res.json({
    id: u.id, username: u.username, bio: u.bio || '',
    avatarUrl: u.avatar_url, musicService: u.music_service,
    musicUsername: u.music_username, createdAt: u.created_at,
    showProjectsOnProfile: u.show_projects_on_profile,
  });
});

// ── GET public profile by username ───────────────────────────
router.get('/user/:username', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, username, bio, avatar_url, music_service, music_username, show_projects_on_profile, created_at
     FROM users WHERE LOWER(username) = LOWER($1)`,
    [req.params.username]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  const u = rows[0];
  res.json({
    id: u.id, username: u.username, bio: u.bio || '',
    avatarUrl: u.avatar_url, musicService: u.music_service,
    musicUsername: u.music_username, createdAt: u.created_at,
    showProjectsOnProfile: u.show_projects_on_profile,
  });
});

// ── GET user's public projects (for profile page) ────────────
router.get('/user/:username/projects', async (req, res) => {
  // Find the target user
  const { rows: userRows } = await pool.query(
    `SELECT id, show_projects_on_profile FROM users WHERE LOWER(username) = LOWER($1)`,
    [req.params.username]
  );
  if (!userRows[0]) return res.status(404).json({ error: 'User not found' });

  const targetUser = userRows[0];

  // If user disabled project visibility, return empty (unless viewing own profile)
  if (!targetUser.show_projects_on_profile && targetUser.id !== req.userId) {
    return res.json([]);
  }

  // Only return projects that are TRULY public (is_public = true set by owner),
  // not private projects the user was merely invited to.
  // Also filter: user must be a member AND project must be explicitly public.
  const { rows } = await pool.query(
    `SELECT p.*,
            u.username AS owner_name,
            (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id) AS member_count,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
     JOIN users u ON u.id = p.user_id
     WHERE p.is_public = true
     ORDER BY p.created_at DESC`,
    [targetUser.id]
  );

  // Check if current (viewing) user is a member of each project
  const { rows: myMemberships } = await pool.query(
    `SELECT project_id FROM project_members WHERE user_id = $1`,
    [req.userId]
  );
  const mySet = new Set(myMemberships.map((m) => m.project_id));

  res.json(rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    isGlobal: r.is_global,
    ownerName: r.owner_name,
    memberCount: parseInt(r.member_count),
    taskCount: parseInt(r.task_count),
    doneCount: parseInt(r.done_count),
    isMember: mySet.has(r.id),
  })));
});

// ── PUT update profile ───────────────────────────────────────
router.put('/me', async (req, res) => {
  const { bio, musicService, musicUsername, avatarUrl, showProjectsOnProfile } = req.body;
  const fields = [
    'bio = $1', 'music_service = $2', 'music_username = $3'
  ];
  const values = [
    (bio || '').slice(0, 300),
    musicService || null,
    musicUsername || null,
  ];

  if (avatarUrl !== undefined) {
    fields.push(`avatar_url = $${values.length + 1}`);
    values.push(avatarUrl);
  }

  if (showProjectsOnProfile !== undefined) {
    fields.push(`show_projects_on_profile = $${values.length + 1}`);
    values.push(showProjectsOnProfile ? true : false);
  }

  values.push(req.userId);
  await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}`,
    values
  );
  res.json({ ok: true });
});

export default router;
