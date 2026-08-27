import { Router } from 'express';
import pool, { uid } from '../db.js';
import { notify, getUsername } from '../notify.js';

const router = Router();

// ── GET public/global projects ────────────────────────────
router.get('/projects', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*,
            u.username AS owner_name,
            (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.task_type = 'shared') +
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.task_type = 'per_member')
              * (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS task_count,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.task_type = 'shared' AND t.status = 'done') +
            (SELECT COUNT(*) FROM task_completions tc
             JOIN tasks t ON t.id = tc.task_id
             WHERE t.project_id = p.id AND t.task_type = 'per_member') AS done_count
     FROM projects p
     JOIN users u ON u.id = p.user_id
     WHERE p.is_public = true
       AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
       AND (p.end_date   IS NULL OR p.end_date   >= CURRENT_DATE)
     ORDER BY p.is_global DESC, p.created_at DESC`
  );

  // Check if current user is a member of each project
  const userId = req.userId;
  const { rows: memberships } = await pool.query(
    `SELECT project_id FROM project_members WHERE user_id = $1`,
    [userId]
  );
  const memberSet = new Set(memberships.map((m) => m.project_id));

  res.json(rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    isGlobal: r.is_global,
    isPublic: r.is_public,
    ownerName: r.owner_name,
    memberCount: parseInt(r.member_count),
    taskCount: parseInt(r.task_count),
    doneCount: parseInt(r.done_count),
    createdAt: r.created_at,
    isMember: memberSet.has(r.id),
  })));
});

// ── POST join a public/global project ─────────────────────
router.post('/projects/:id/join', async (req, res) => {
  const { rows: projectRows } = await pool.query(
    'SELECT * FROM projects WHERE id = $1 AND (is_public = true OR is_global = true)',
    [req.params.id]
  );
  if (!projectRows[0]) return res.status(404).json({ error: 'Project not found or not public' });

  const { rows: existing } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );
  if (existing.length > 0) return res.status(409).json({ error: 'Already a member' });

  await pool.query(
    'INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [uid(), req.params.id, req.userId, 'member']
  );

  // Notify project owner
  const project = projectRows[0];
  const actor = await getUsername(req.userId);
  await notify(project.user_id, req.userId, 'project_join',
    `${actor} joined "${project.name}"`, 'project', req.params.id);

  res.json({ ok: true });
});

// ── POST leave a public/global project ────────────────────
router.post('/projects/:id/leave', async (req, res) => {
  const { rows: projectRows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  if (!projectRows[0]) return res.status(404).json({ error: 'Project not found' });

  if (projectRows[0].user_id === req.userId) {
    return res.status(400).json({ error: 'Owner cannot leave' });
  }

  await pool.query(
    'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );

  // Notify project owner
  const actor = await getUsername(req.userId);
  await notify(projectRows[0].user_id, req.userId, 'project_leave',
    `${actor} left "${projectRows[0].name}"`, 'project', req.params.id);

  res.json({ ok: true });
});

export default router;
