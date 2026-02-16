import { Router } from 'express';
import db, { uid } from '../db.js';

const router = Router();

const allForUser = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at');
const findOne = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?');
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
  };
}

router.get('/', (req, res) => {
  const rows = allForUser.all(req.userId);
  res.json(rows.map(toJSON));
});

router.post('/', (req, res) => {
  const { title, description, projectId, status, priority, dueDate, customFields } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

  const id = req.body.id || uid();
  const cf = JSON.stringify(customFields || []);
  const existing = findOne.get(id, req.userId);

  if (existing) {
    update.run(
      projectId || null, title.trim(), description || '', status || 'todo',
      priority || 'medium', dueDate || null, cf, id, req.userId
    );
  } else {
    insert.run(
      id, req.userId, projectId || null, title.trim(), description || '',
      status || 'todo', priority || 'medium', dueDate || null, cf
    );
  }

  const row = findOne.get(id, req.userId);
  res.json(toJSON(row));
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
