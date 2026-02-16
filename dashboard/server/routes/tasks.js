import { Router } from 'express';
import pool, { uid } from '../db.js';

const router = Router();

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

// Own tasks + tasks from shared projects
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (t.id) t.*, u.username AS creator_username FROM tasks t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN project_members pm ON t.project_id = pm.project_id AND pm.user_id = $1
     WHERE t.user_id = $1 OR pm.user_id = $1
     ORDER BY t.id, t.created_at`,
    [req.userId]
  );
  res.json(rows.map(toJSON));
});

router.post('/', async (req, res) => {
  const { title, description, projectId, status, priority, dueDate, customFields } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

  const id = req.body.id || uid();
  const cf = JSON.stringify(customFields || []);

  const { rows: existingRows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  const existing = existingRows[0];

  if (existing) {
    if (existing.user_id !== req.userId) {
      return res.status(403).json({ error: 'Only the task creator can edit' });
    }
    await pool.query(
      `UPDATE tasks SET project_id = $1, title = $2, description = $3, status = $4,
       priority = $5, due_date = $6, custom_fields = $7 WHERE id = $8 AND user_id = $9`,
      [projectId || null, title.trim(), description || '', status || 'todo',
       priority || 'medium', dueDate || null, cf, id, req.userId]
    );
  } else {
    if (projectId) {
      const { rows: access } = await pool.query(
        `SELECT 1 FROM projects p
         LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
         WHERE p.id = $2 AND (p.user_id = $1 OR pm.user_id = $1)`,
        [req.userId, projectId]
      );
      if (access.length === 0) return res.status(403).json({ error: 'No access to this project' });
    }
    await pool.query(
      `INSERT INTO tasks (id, user_id, project_id, title, description, status, priority, due_date, custom_fields)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, req.userId, projectId || null, title.trim(), description || '',
       status || 'todo', priority || 'medium', dueDate || null, cf]
    );
  }

  const { rows } = await pool.query(
    `SELECT t.*, u.username AS creator_username FROM tasks t
     JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
    [id]
  );
  res.json(toJSON(rows[0]));
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
});

// Bulk delete tasks by project (used when deleting a project)
router.delete('/by-project/:projectId', async (req, res) => {
  await pool.query('DELETE FROM tasks WHERE project_id = $1 AND user_id = $2', [req.params.projectId, req.userId]);
  res.json({ ok: true });
});

export default router;
