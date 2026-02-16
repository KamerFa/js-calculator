import { Router } from 'express';
import pool, { uid } from '../db.js';

const router = Router();

function toJSON(row, extra = {}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    isPublic: row.is_public || false,
    isGlobal: row.is_global || false,
    createdAt: row.created_at,
    ownerId: row.user_id,
    ...extra,
  };
}

// ── GET all projects (owned + shared) ────────────────────────
router.get('/', async (req, res) => {
  const { rows: owned } = await pool.query(
    `SELECT p.*, (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count
     FROM projects p WHERE p.user_id = $1 ORDER BY p.created_at`,
    [req.userId]
  );
  const { rows: shared } = await pool.query(
    `SELECT p.*, pm.role,
            (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id) AS member_count
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id
     WHERE pm.user_id = $1 AND p.user_id != $1
     ORDER BY p.created_at`,
    [req.userId]
  );

  const result = [
    ...owned.map((r) => toJSON(r, { isOwner: true, memberCount: parseInt(r.member_count) })),
    ...shared.map((r) => toJSON(r, { isOwner: false, role: r.role, memberCount: parseInt(r.member_count) })),
  ];
  res.json(result);
});

// ── POST create/update project ───────────────────────────────
router.post('/', async (req, res) => {
  const { name, description, color, isPublic } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  const id = req.body.id || uid();
  const pub = isPublic ? true : false;
  const { rows: existingRows } = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
  const existing = existingRows[0];

  if (existing) {
    if (existing.user_id !== req.userId) {
      return res.status(403).json({ error: 'Only the project owner can edit' });
    }
    await pool.query(
      'UPDATE projects SET name = $1, description = $2, color = $3, is_public = $4 WHERE id = $5 AND user_id = $6',
      [name.trim(), description || '', color || '#2a5caa', pub, id, req.userId]
    );
  } else {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO projects (id, user_id, name, description, color, is_public) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, req.userId, name.trim(), description || '', color || '#2a5caa', pub]
      );
      await client.query(
        'INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, $4)',
        [uid(), id, req.userId, 'owner']
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  const { rows } = await pool.query(
    `SELECT p.*, (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count
     FROM projects p WHERE p.id = $1`,
    [id]
  );
  res.json(toJSON(rows[0], { isOwner: true, memberCount: parseInt(rows[0].member_count) }));
});

// ── DELETE project (owner only) ──────────────────────────────
router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.json({ ok: true });
  if (rows[0].user_id !== req.userId) {
    return res.status(403).json({ error: 'Only the project owner can delete' });
  }
  await pool.query('DELETE FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
});

// ── GET project members ──────────────────────────────────────
router.get('/:id/members', async (req, res) => {
  const { rows: projectRows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  if (!projectRows[0]) return res.status(404).json({ error: 'Project not found' });

  const project = projectRows[0];
  const { rows: memberCheck } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );
  if (project.user_id !== req.userId && memberCheck.length === 0) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { rows: members } = await pool.query(
    `SELECT pm.*, u.username FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY pm.role DESC, pm.joined_at`,
    [req.params.id]
  );

  const { rows: taskStats } = await pool.query(
    `SELECT user_id,
            COUNT(*) as total,
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
     FROM tasks WHERE project_id = $1 GROUP BY user_id`,
    [req.params.id]
  );

  const statsMap = {};
  for (const s of taskStats) {
    statsMap[s.user_id] = { total: parseInt(s.total), done: parseInt(s.done) };
  }

  res.json(members.map((m) => ({
    userId: m.user_id,
    username: m.username,
    role: m.role,
    joinedAt: m.joined_at,
    tasks: statsMap[m.user_id] || { total: 0, done: 0 },
  })));
});

// ── POST add member to project ───────────────────────────────
router.post('/:id/members', async (req, res) => {
  const { rows: projectRows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  if (!projectRows[0]) return res.status(404).json({ error: 'Project not found' });
  if (projectRows[0].user_id !== req.userId) {
    return res.status(403).json({ error: 'Only the project owner can add members' });
  }

  const { username } = req.body;
  if (!username?.trim()) return res.status(400).json({ error: 'Username required' });

  const { rows: userRows } = await pool.query(
    'SELECT id, username FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]
  );
  if (!userRows[0]) return res.status(404).json({ error: 'User not found' });

  const targetUser = userRows[0];
  if (targetUser.id === req.userId) {
    return res.status(400).json({ error: 'You are already the owner' });
  }

  const { rows: existingMember } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [req.params.id, targetUser.id]
  );
  if (existingMember.length > 0) return res.status(409).json({ error: 'User is already a member' });

  await pool.query(
    'INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [uid(), req.params.id, targetUser.id, 'member']
  );
  res.json({ ok: true, username: targetUser.username, userId: targetUser.id });
});

// ── DELETE remove member from project ────────────────────────
router.delete('/:id/members/:userId', async (req, res) => {
  const { rows: projectRows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  if (!projectRows[0]) return res.status(404).json({ error: 'Project not found' });

  const project = projectRows[0];
  if (project.user_id !== req.userId && req.params.userId !== req.userId) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  if (req.params.userId === project.user_id) {
    return res.status(400).json({ error: 'Cannot remove the project owner' });
  }

  await pool.query(
    'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
    [req.params.id, req.params.userId]
  );
  res.json({ ok: true });
});

export default router;
