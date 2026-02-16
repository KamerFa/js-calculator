import { Router } from 'express';
import db, { uid } from '../db.js';

const router = Router();

// Own tasks + tasks from shared projects
const visibleTasks = db.prepare(
  `SELECT DISTINCT t.*, u.username as creator_username FROM tasks t
   JOIN users u ON u.id = t.user_id
   LEFT JOIN project_members pm ON t.project_id = pm.project_id AND pm.user_id = ?
   WHERE t.user_id = ? OR pm.user_id = ?
   ORDER BY t.created_at`
);
const findOne = db.prepare('SELECT * FROM tasks WHERE id = ?');
const insert = db.prepare(
  `INSERT INTO tasks (id, user_id, project_id, title, description, status, priority, due_date, custom_fields)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const update = db.prepare(
  `UPDATE tasks SET project_id = ?, title = ?, description = ?, status = ?, priority = ?, due_date = ?, custom_fields = ?
   WHERE id = ? AND user_id = ?`
);
const remove = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?');
const removeByProject = db.prepare('DELETE FROM tasks WHERE project_id = ? AND user_id = ?');

// Check if user can access a project (owner or member)
const canAccessProject = db.prepare(
  `SELECT 1 FROM projects p
   LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
   WHERE p.id = ? AND (p.user_id = ? OR pm.user_id = ?)`
);

function toJSON(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    customFields: JSON.parse(row.custom_fields || '[]'),
    createdAt: row.created_at,
    userId: row.user_id,
    createdBy: row.creator_username || null,
  };
}

router.get('/', (req, res) => {
  const rows = visibleTasks.all(req.userId, req.userId, req.userId);
  res.json(rows.map(toJSON));
});

router.post('/', (req, res) => {
  const { title, description, projectId, status, priority, dueDate, customFields } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

  const id = req.body.id || uid();
  const cf = JSON.stringify(customFields || []);
  const existing = findOne.get(id);

  if (existing) {
    // Only the task creator can edit
    if (existing.user_id !== req.userId) {
      return res.status(403).json({ error: 'Only the task creator can edit' });
    }
    update.run(
      projectId || null, title.trim(), description || '', status || 'todo',
      priority || 'medium', dueDate || null, cf, id, req.userId
    );
  } else {
    // If adding to a project, verify access
    if (projectId) {
      const access = canAccessProject.get(req.userId, projectId, req.userId, req.userId);
      if (!access) return res.status(403).json({ error: 'No access to this project' });
    }
    insert.run(
      id, req.userId, projectId || null, title.trim(), description || '',
      status || 'todo', priority || 'medium', dueDate || null, cf
    );
  }

  const row = findOne.get(id);
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(row.user_id);
  res.json(toJSON({ ...row, creator_username: user?.username }));
});

router.delete('/:id', (req, res) => {
  remove.run(req.params.id, req.userId);
  res.json({ ok: true });
});

// Bulk delete tasks by project (used when deleting a project)
router.delete('/by-project/:projectId', (req, res) => {
  removeByProject.run(req.params.projectId, req.userId);
  res.json({ ok: true });
});

export default router;
