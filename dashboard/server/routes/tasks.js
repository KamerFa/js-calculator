import { Router } from 'express';
import pool, { uid } from '../db.js';

const router = Router();

function toJSON(row) {
  const isPerMember = row.task_type === 'per_member';

  // For per_member tasks, derive status from user's completion record
  let effectiveStatus = row.status;
  let effectiveCompletedAt = row.completed_at || null;
  let effectiveCompletedBy = row.completer_username || null;

  if (isPerMember) {
    effectiveStatus = row.my_completed_at ? 'done' : 'todo';
    effectiveCompletedAt = row.my_completed_at || null;
    effectiveCompletedBy = null; // per-member: you complete it for yourself
  }

  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: effectiveStatus,
    priority: row.priority,
    dueDate: row.due_date,
    recurrence: row.recurrence || 'none',
    completedAt: effectiveCompletedAt,
    completedBy: effectiveCompletedBy,
    screenshotUrl: row.screenshot_url || null,
    customFields: JSON.parse(row.custom_fields || '[]'),
    createdAt: row.created_at,
    userId: row.user_id,
    createdBy: row.creator_username || null,
    taskType: row.task_type || 'shared',
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

// ── Helper: should this shared recurring task auto-reset? ──
function shouldReset(task) {
  if (!task.recurrence || task.recurrence === 'none') return false;
  if (task.status !== 'done') return false;
  if (!task.completed_at) return false;

  return isStaleCompletion(task.recurrence, task.completed_at);
}

// ── Helper: should a per-member completion be reset? ───────
function isStaleCompletion(recurrence, completedAt) {
  if (!recurrence || recurrence === 'none') return false;
  if (!completedAt) return false;

  const completedDate = new Date(completedAt).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  if (recurrence === 'daily') return completedDate < today;
  if (recurrence === 'weekly') {
    const diff = (new Date(today) - new Date(completedDate)) / 86400000;
    return diff >= 7;
  }
  if (recurrence === 'monthly') {
    const comp = new Date(completedDate);
    const now = new Date(today);
    return now.getMonth() !== comp.getMonth() || now.getFullYear() !== comp.getFullYear();
  }
  return false;
}

// ── GET: Own tasks + tasks from shared projects ───────────
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (t.id) t.*, u.username AS creator_username, cu.username AS completer_username,
            tc.completed_at AS my_completed_at
     FROM tasks t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN users cu ON cu.id = t.completed_by
     LEFT JOIN project_members pm ON t.project_id = pm.project_id AND pm.user_id = $1
     LEFT JOIN task_completions tc ON tc.task_id = t.id AND tc.user_id = $1
     LEFT JOIN projects proj ON proj.id = t.project_id
     WHERE (t.user_id = $1 OR pm.user_id = $1)
       AND (proj.start_date IS NULL OR proj.start_date <= CURRENT_DATE)
       AND (proj.end_date   IS NULL OR proj.end_date   >= CURRENT_DATE)
     ORDER BY t.id, t.created_at`,
    [req.userId]
  );

  // Auto-reset recurring tasks
  const sharedResetIds = [];
  const perMemberResetIds = [];

  for (const row of rows) {
    if (row.task_type === 'per_member') {
      // Per-member: check if THIS USER's completion is stale
      if (row.my_completed_at && isStaleCompletion(row.recurrence, row.my_completed_at)) {
        perMemberResetIds.push(row.id);
        row.my_completed_at = null; // clear in-memory for response
      }
    } else {
      // Shared: existing reset logic
      if (shouldReset(row)) {
        sharedResetIds.push(row.id);
        row.status = 'todo';
        row.completed_at = null;
        row.completed_by = null;
        row.completer_username = null;
        if (row.due_date) {
          row.due_date = nextDueDate(row.recurrence, row.due_date);
        }
      }
    }
  }

  // Batch reset per-member completions
  if (perMemberResetIds.length > 0) {
    await pool.query(
      `DELETE FROM task_completions WHERE user_id = $1 AND task_id = ANY($2::text[])`,
      [req.userId, perMemberResetIds]
    );
  }

  // Batch reset shared tasks
  if (sharedResetIds.length > 0) {
    for (const id of sharedResetIds) {
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
  const { title, description, projectId, status, priority, dueDate, customFields, recurrence, taskType } = req.body;
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

    // Per-member tasks: toggle via task_completions, not tasks.status
    if (existing.task_type === 'per_member') {
      const newStatus = status || existing.status;
      if (newStatus === 'done') {
        await pool.query(
          `INSERT INTO task_completions (id, task_id, user_id) VALUES ($1, $2, $3) ON CONFLICT (task_id, user_id) DO NOTHING`,
          [uid(), existing.id, req.userId]
        );
      } else {
        await pool.query(
          `DELETE FROM task_completions WHERE task_id = $1 AND user_id = $2`,
          [existing.id, req.userId]
        );
      }
      // Return the task with this user's completion state
      const { rows } = await pool.query(
        `SELECT t.*, u.username AS creator_username, cu.username AS completer_username,
                tc.completed_at AS my_completed_at
         FROM tasks t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN users cu ON cu.id = t.completed_by
         LEFT JOIN task_completions tc ON tc.task_id = t.id AND tc.user_id = $1
         WHERE t.id = $2`,
        [req.userId, existing.id]
      );
      return res.json(toJSON(rows[0]));
    }

    // Shared tasks: existing logic
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
      `INSERT INTO tasks (id, user_id, project_id, title, description, status, priority, due_date, custom_fields, recurrence, task_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, req.userId, projectId || null, title.trim(), description || '',
       status || 'todo', priority || 'medium', dueDate || null, cf, rec, taskType || 'shared']
    );
  }

  const { rows } = await pool.query(
    `SELECT t.*, u.username AS creator_username, cu.username AS completer_username,
            tc.completed_at AS my_completed_at
     FROM tasks t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN users cu ON cu.id = t.completed_by
     LEFT JOIN task_completions tc ON tc.task_id = t.id AND tc.user_id = $1
     WHERE t.id = $2`,
    [req.userId, id]
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
