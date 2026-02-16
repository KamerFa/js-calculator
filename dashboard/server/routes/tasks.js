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
    recurrence: row.recurrence || 'none',
    completedAt: row.completed_at || null,
    completedBy: row.completer_username || null,
    screenshotUrl: row.screenshot_url || null,
    customFields: JSON.parse(row.custom_fields || '[]'),
    createdAt: row.created_at,
    userId: row.user_id,
    createdBy: row.creator_username || null,
  };
}

// ── Helper: compute next due date from recurrence ─────────
function nextDueDate(recurrence, fromDate) {
  const d = fromDate ? new Date(fromDate) : new Date();
  switch (recurrence) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    default: return null;
  }
  return d.toISOString().split('T')[0];
}

// ── Helper: should this recurring task auto-reset? ────────
function shouldReset(task) {
  if (!task.recurrence || task.recurrence === 'none') return false;
  if (task.status !== 'done') return false;
  if (!task.completed_at) return false;

  const completedDate = new Date(task.completed_at).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  if (task.recurrence === 'daily') return completedDate < today;
  if (task.recurrence === 'weekly') {
    const diff = (new Date(today) - new Date(completedDate)) / 86400000;
    return diff >= 7;
  }
  if (task.recurrence === 'monthly') {
    const comp = new Date(completedDate);
    const now = new Date(today);
    return now.getMonth() !== comp.getMonth() || now.getFullYear() !== comp.getFullYear();
  }
  return false;
}

// ── GET: Own tasks + tasks from shared projects ───────────
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (t.id) t.*, u.username AS creator_username, cu.username AS completer_username
     FROM tasks t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN users cu ON cu.id = t.completed_by
     LEFT JOIN project_members pm ON t.project_id = pm.project_id AND pm.user_id = $1
     WHERE t.user_id = $1 OR pm.user_id = $1
     ORDER BY t.id, t.created_at`,
    [req.userId]
  );

  // Auto-reset recurring tasks that are due
  const resetIds = [];
  for (const row of rows) {
    if (shouldReset(row)) {
      resetIds.push(row.id);
      row.status = 'todo';
      row.completed_at = null;
      row.completed_by = null;
      row.completer_username = null;
      // Advance due_date if it exists
      if (row.due_date) {
        row.due_date = nextDueDate(row.recurrence, row.due_date);
      }
    }
  }

  if (resetIds.length > 0) {
    // Batch reset in DB
    for (const id of resetIds) {
      const row = rows.find((r) => r.id === id);
      await pool.query(
        `UPDATE tasks SET status = 'todo', completed_at = NULL, completed_by = NULL, due_date = $1 WHERE id = $2`,
        [row.due_date, id]
      );
    }
  }

  res.json(rows.map(toJSON));
});

// ── POST: Create or update task ───────────────────────────
router.post('/', async (req, res) => {
  const { title, description, projectId, status, priority, dueDate, customFields, recurrence } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

  const id = req.body.id || uid();
  const cf = JSON.stringify(customFields || []);
  const rec = recurrence || 'none';

  const { rows: existingRows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  const existing = existingRows[0];

  if (existing) {
    // Allow task creator OR project members to update (for global/shared projects)
    const canEdit = existing.user_id === req.userId;
    let canToggle = canEdit;

    if (!canEdit && existing.project_id) {
      const { rows: memberCheck } = await pool.query(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [existing.project_id, req.userId]
      );
      canToggle = memberCheck.length > 0;
    }

    if (!canToggle) {
      return res.status(403).json({ error: 'No access to this task' });
    }

    // If only toggling status (member but not creator), restrict to status-only updates
    if (!canEdit && canToggle) {
      // Members can only toggle status
      const newStatus = status || existing.status;
      const completedAt = newStatus === 'done' ? new Date().toISOString() : null;
      const completedBy = newStatus === 'done' ? req.userId : null;
      await pool.query(
        `UPDATE tasks SET status = $1, completed_at = $2, completed_by = $3 WHERE id = $4`,
        [newStatus, completedAt, completedBy, id]
      );
    } else {
      // Full edit by owner
      const completedAt = (status === 'done' && existing.status !== 'done') ? new Date().toISOString() :
                          (status !== 'done' ? null : existing.completed_at);
      const completedBy = (status === 'done' && existing.status !== 'done') ? req.userId :
                          (status !== 'done' ? null : existing.completed_by);
      await pool.query(
        `UPDATE tasks SET project_id = $1, title = $2, description = $3, status = $4,
         priority = $5, due_date = $6, custom_fields = $7, recurrence = $8, completed_at = $9, completed_by = $10
         WHERE id = $11 AND user_id = $12`,
        [projectId || null, title.trim(), description || '', status || 'todo',
         priority || 'medium', dueDate || null, cf, rec, completedAt, completedBy, id, req.userId]
      );
    }
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
      `INSERT INTO tasks (id, user_id, project_id, title, description, status, priority, due_date, custom_fields, recurrence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, req.userId, projectId || null, title.trim(), description || '',
       status || 'todo', priority || 'medium', dueDate || null, cf, rec]
    );
  }

  const { rows } = await pool.query(
    `SELECT t.*, u.username AS creator_username, cu.username AS completer_username
     FROM tasks t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN users cu ON cu.id = t.completed_by
     WHERE t.id = $1`,
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
