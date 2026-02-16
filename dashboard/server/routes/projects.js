import { Router } from 'express';
import db, { uid } from '../db.js';

const router = Router();

// ── Prepared statements ──────────────────────────────────────
const ownedByUser = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at');
const sharedWithUser = db.prepare(
  `SELECT p.*, pm.role FROM projects p
   JOIN project_members pm ON pm.project_id = p.id
   WHERE pm.user_id = ? AND p.user_id != ?
   ORDER BY p.created_at`
);
const findOne = db.prepare('SELECT * FROM projects WHERE id = ?');
const insert = db.prepare(
  'INSERT INTO projects (id, user_id, name, description, color) VALUES (?, ?, ?, ?, ?)'
);
const update = db.prepare(
  'UPDATE projects SET name = ?, description = ?, color = ? WHERE id = ? AND user_id = ?'
);
const remove = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?');

const insertMember = db.prepare(
  'INSERT OR IGNORE INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)'
);
const removeMember = db.prepare(
  'DELETE FROM project_members WHERE project_id = ? AND user_id = ?'
);
const getMembers = db.prepare(
  `SELECT pm.*, u.username FROM project_members pm
   JOIN users u ON u.id = pm.user_id
   WHERE pm.project_id = ?
   ORDER BY pm.role DESC, pm.joined_at`
);
const isMember = db.prepare(
  'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?'
);
const findUserByUsername = db.prepare('SELECT id, username FROM users WHERE username = ? COLLATE NOCASE');

const memberCount = db.prepare('SELECT COUNT(*) as cnt FROM project_members WHERE project_id = ?');

function toJSON(row, extra = {}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    createdAt: row.created_at,
    ownerId: row.user_id,
    ...extra,
  };
}

// ── GET all projects (owned + shared) ────────────────────────
router.get('/', (req, res) => {
  const owned = ownedByUser.all(req.userId).map((r) => {
    const mc = memberCount.get(r.id).cnt;
    return toJSON(r, { isOwner: true, memberCount: mc });
  });
  const shared = sharedWithUser.all(req.userId, req.userId).map((r) => {
    const mc = memberCount.get(r.id).cnt;
    return toJSON(r, { isOwner: false, role: r.role, memberCount: mc });
  });
  res.json([...owned, ...shared]);
});

// ── POST create/update project ───────────────────────────────
router.post('/', (req, res) => {
  const { name, description, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  const id = req.body.id || uid();
  const existing = findOne.get(id);

  if (existing) {
    // Only the owner can update
    if (existing.user_id !== req.userId) {
      return res.status(403).json({ error: 'Only the project owner can edit' });
    }
    update.run(name.trim(), description || '', color || '#2a5caa', id, req.userId);
  } else {
    // Create new project and add owner as member
    const createProject = db.transaction(() => {
      insert.run(id, req.userId, name.trim(), description || '', color || '#2a5caa');
      insertMember.run(uid(), id, req.userId, 'owner');
    });
    createProject();
  }

  const row = findOne.get(id);
  const mc = memberCount.get(id).cnt;
  res.json(toJSON(row, { isOwner: true, memberCount: mc }));
});

// ── DELETE project (owner only) ──────────────────────────────
router.delete('/:id', (req, res) => {
  const project = findOne.get(req.params.id);
  if (!project) return res.json({ ok: true });
  if (project.user_id !== req.userId) {
    return res.status(403).json({ error: 'Only the project owner can delete' });
  }
  remove.run(req.params.id, req.userId);
  res.json({ ok: true });
});

// ── GET project members ──────────────────────────────────────
router.get('/:id/members', (req, res) => {
  const project = findOne.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Must be owner or member
  const canView = project.user_id === req.userId || isMember.get(req.params.id, req.userId);
  if (!canView) return res.status(403).json({ error: 'Access denied' });

  const members = getMembers.all(req.params.id);

  // Get task stats per member
  const taskStats = db.prepare(
    `SELECT user_id,
            COUNT(*) as total,
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
     FROM tasks WHERE project_id = ? GROUP BY user_id`
  ).all(req.params.id);

  const statsMap = {};
  for (const s of taskStats) {
    statsMap[s.user_id] = { total: s.total, done: s.done };
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
router.post('/:id/members', (req, res) => {
  const project = findOne.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.user_id !== req.userId) {
    return res.status(403).json({ error: 'Only the project owner can add members' });
  }

  const { username } = req.body;
  if (!username?.trim()) return res.status(400).json({ error: 'Username required' });

  const targetUser = findUserByUsername.get(username.trim());
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  if (targetUser.id === req.userId) {
    return res.status(400).json({ error: 'You are already the owner' });
  }

  const existing = isMember.get(req.params.id, targetUser.id);
  if (existing) return res.status(409).json({ error: 'User is already a member' });

  insertMember.run(uid(), req.params.id, targetUser.id, 'member');
  res.json({ ok: true, username: targetUser.username, userId: targetUser.id });
});

// ── DELETE remove member from project ────────────────────────
router.delete('/:id/members/:userId', (req, res) => {
  const project = findOne.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Owner can remove anyone; members can remove themselves
  if (project.user_id !== req.userId && req.params.userId !== req.userId) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Cannot remove the owner
  if (req.params.userId === project.user_id) {
    return res.status(400).json({ error: 'Cannot remove the project owner' });
  }

  removeMember.run(req.params.id, req.params.userId);
  res.json({ ok: true });
});

export default router;
