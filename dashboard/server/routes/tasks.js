import { Router } from 'express';
import pool, { uid } from '../db.js';
import { notify, notifyProjectMembers, getUsername } from '../notify.js';

const router = Router();

function toJSON(row, completionDatesMap) {
  const isPerMember = row.task_type === 'per_member';
  const isRecurring = row.recurrence && row.recurrence !== 'none';
  const today = new Date().toISOString().split('T')[0];

  // For per_member tasks, derive status from user's completion record
  let effectiveStatus = row.status;
  let effectiveCompletedAt = row.completed_at || null;
  let effectiveCompletedBy = row.completer_username || null;

  if (isPerMember) {
    if (isRecurring) {
      // For recurring/repeatable per_member tasks, check if TODAY has a completion
      const dates = completionDatesMap?.[row.id] || [];
      effectiveStatus = dates.includes(today) ? 'done' : 'todo';
      effectiveCompletedAt = dates.includes(today) ? row.my_completed_at : null;
    } else {
      effectiveStatus = row.my_completed_at ? 'done' : 'todo';
      effectiveCompletedAt = row.my_completed_at || null;
    }
    effectiveCompletedBy = null; // per-member: you complete it for yourself
  }

  const result = {
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
    scheduledDate: row.scheduled_date || null,
    customFields: JSON.parse(row.custom_fields || '[]'),
    createdAt: row.created_at,
    userId: row.user_id,
    createdBy: row.creator_username || null,
    taskType: row.task_type || 'shared',
    completionCount: row.completion_count || 0,
    currentStreak: row.current_streak || 0,
    bestStreak: row.best_streak || 0,
  };

  // Include completion dates for recurring/repeatable per_member tasks (for calendar view)
  if (isPerMember && isRecurring && completionDatesMap?.[row.id]) {
    result.completionDates = completionDatesMap[row.id];
  }

  // For shared recurring/repeatable tasks, include the specific completion date
  if (!isPerMember && isRecurring && row.completed_at) {
    result.completionDates = [new Date(row.completed_at).toISOString().split('T')[0]];
  }

  return result;
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

// ── Helper: should this shared recurring/repeatable task auto-reset? ──
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

  // Repeatable tasks reset daily (same as daily recurrence)
  if (recurrence === 'repeatable') return completedDate < today;
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

// ── Helper: compute streak from completion log ─────────────
async function computeStreak(taskId, userId, recurrence) {
  const { rows } = await pool.query(
    `SELECT DISTINCT completion_date FROM task_completion_log
     WHERE task_id = $1 AND user_id = $2
     ORDER BY completion_date DESC`,
    [taskId, userId]
  );

  if (rows.length === 0) return { current: 0, best: 0 };

  const dates = rows.map((r) => r.completion_date);
  const today = new Date().toISOString().split('T')[0];

  let current = 0;
  let best = 0;
  let streak = 0;

  if (recurrence === 'repeatable' || recurrence === 'daily') {
    // Count consecutive days ending today or yesterday
    for (let i = 0; i < dates.length; i++) {
      const expected = new Date();
      expected.setDate(expected.getDate() - i);
      const expectedDate = expected.toISOString().split('T')[0];

      if (dates.includes(expectedDate)) {
        streak++;
      } else if (i === 0) {
        // Today not completed yet - check if yesterday starts a streak
        continue;
      } else {
        break;
      }
    }
    current = streak;

    // Compute best streak by walking all dates
    streak = 1;
    best = 1;
    const sorted = [...dates].sort();
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const curr = new Date(sorted[i]);
      const diffDays = (curr - prev) / 86400000;
      if (diffDays === 1) {
        streak++;
        best = Math.max(best, streak);
      } else {
        streak = 1;
      }
    }
    best = Math.max(best, current);
  } else if (recurrence === 'weekly') {
    // Count consecutive weeks
    const getWeek = (d) => {
      const dt = new Date(d);
      const start = new Date(dt.getFullYear(), 0, 1);
      return Math.ceil(((dt - start) / 86400000 + start.getDay() + 1) / 7);
    };
    const thisWeek = getWeek(today);
    const thisYear = new Date().getFullYear();
    // Simplified: check if dates exist in consecutive weeks
    current = dates.length > 0 ? 1 : 0;
    best = current;
  } else if (recurrence === 'monthly') {
    current = dates.length > 0 ? 1 : 0;
    best = current;
  }

  return { current, best: Math.max(best, current) };
}

// ── Helper: log completion and update streak/count ─────────
async function logCompletion(taskId, userId, recurrence) {
  const today = new Date().toISOString().split('T')[0];

  // Check if already logged today (prevent duplicates)
  const { rows: existing } = await pool.query(
    `SELECT id FROM task_completion_log WHERE task_id = $1 AND user_id = $2 AND completion_date = $3`,
    [taskId, userId, today]
  );

  if (existing.length === 0) {
    await pool.query(
      `INSERT INTO task_completion_log (id, task_id, user_id, completion_date) VALUES ($1, $2, $3, $4)`,
      [uid(), taskId, userId, today]
    );
  }

  // Increment completion count
  await pool.query(
    `UPDATE tasks SET completion_count = completion_count + 1 WHERE id = $1`,
    [taskId]
  );

  // Compute and update streak
  const { current, best } = await computeStreak(taskId, userId, recurrence);
  await pool.query(
    `UPDATE tasks SET current_streak = $1, best_streak = GREATEST(best_streak, $2) WHERE id = $3`,
    [current, best, taskId]
  );
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
     ORDER BY t.id, t.created_at`,
    [req.userId]
  );

  // Fetch all completion dates for recurring/repeatable per_member tasks (for calendar view)
  const recurringPerMemberIds = rows
    .filter((r) => r.task_type === 'per_member' && r.recurrence && r.recurrence !== 'none')
    .map((r) => r.id);

  const completionDatesMap = {};
  if (recurringPerMemberIds.length > 0) {
    const { rows: completionRows } = await pool.query(
      `SELECT task_id, completion_date FROM task_completions
       WHERE user_id = $1 AND task_id = ANY($2::text[]) AND completion_date IS NOT NULL`,
      [req.userId, recurringPerMemberIds]
    );
    for (const cr of completionRows) {
      if (!completionDatesMap[cr.task_id]) completionDatesMap[cr.task_id] = [];
      completionDatesMap[cr.task_id].push(cr.completion_date);
    }
  }

  // Auto-reset shared recurring/repeatable tasks only (per_member uses date-based tracking)
  const sharedResetIds = [];

  for (const row of rows) {
    if (row.task_type !== 'per_member') {
      // Shared: existing reset logic (also handles repeatable via shouldReset)
      if (shouldReset(row)) {
        sharedResetIds.push(row.id);
        row.status = 'todo';
        row.completed_at = null;
        row.completed_by = null;
        row.completer_username = null;
        // Repeatable tasks don't advance due_date
        if (row.due_date && row.recurrence !== 'repeatable') {
          row.due_date = nextDueDate(row.recurrence, row.due_date);
        }
      }
    }
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

  res.json(rows.map((r) => toJSON(r, completionDatesMap)));
});

// ── GET: Task completion history ───────────────────────────
router.get('/:id/history', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT tcl.completion_date, tcl.completed_at, u.username
     FROM task_completion_log tcl
     JOIN users u ON u.id = tcl.user_id
     WHERE tcl.task_id = $1
     ORDER BY tcl.completed_at DESC
     LIMIT 50`,
    [req.params.id]
  );
  res.json(rows.map((r) => ({
    completionDate: r.completion_date,
    completedAt: r.completed_at,
    username: r.username,
  })));
});

// ── POST: Create or update task ───────────────────────────
router.post('/', async (req, res) => {
  const { title, description, projectId, status, priority, dueDate, scheduledDate, customFields, recurrence, taskType } = req.body;
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
      const isRecurring = existing.recurrence && existing.recurrence !== 'none';
      // For recurring/repeatable tasks, use the provided completionDate; for non-recurring, use today
      const completionDate = req.body.completionDate || new Date().toISOString().split('T')[0];

      if (newStatus === 'done') {
        await pool.query(
          `INSERT INTO task_completions (id, task_id, user_id, completion_date) VALUES ($1, $2, $3, $4)
           ON CONFLICT (task_id, user_id, completion_date) DO NOTHING`,
          [uid(), existing.id, req.userId, completionDate]
        );

        // Log completion for repeatable/recurring tasks (streak tracking)
        if (isRecurring) {
          await logCompletion(existing.id, req.userId, existing.recurrence);
        }

        // Notify project members about completion
        if (existing.project_id) {
          const actor = await getUsername(req.userId);
          await notifyProjectMembers(existing.project_id, req.userId, 'task_completed',
            `${actor} completed "${existing.title}"`, 'task', existing.id);
        }
      } else {
        if (isRecurring) {
          // For recurring/repeatable tasks, only delete the specific date's completion
          await pool.query(
            `DELETE FROM task_completions WHERE task_id = $1 AND user_id = $2 AND completion_date = $3`,
            [existing.id, req.userId, completionDate]
          );
        } else {
          await pool.query(
            `DELETE FROM task_completions WHERE task_id = $1 AND user_id = $2`,
            [existing.id, req.userId]
          );
        }
      }
      // Return the task with this user's completion state
      const { rows } = await pool.query(
        `SELECT t.*, u.username AS creator_username, cu.username AS completer_username,
                tc.completed_at AS my_completed_at
         FROM tasks t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN users cu ON cu.id = t.completed_by
         LEFT JOIN task_completions tc ON tc.task_id = t.id AND tc.user_id = $1 AND tc.completion_date = $3
         WHERE t.id = $2
         LIMIT 1`,
        [req.userId, existing.id, completionDate]
      );

      // Also fetch all completion dates for recurring/repeatable tasks
      const completionDatesMap = {};
      if (isRecurring) {
        const { rows: cdRows } = await pool.query(
          `SELECT completion_date FROM task_completions WHERE task_id = $1 AND user_id = $2 AND completion_date IS NOT NULL`,
          [existing.id, req.userId]
        );
        completionDatesMap[existing.id] = cdRows.map((r) => r.completion_date);
      }

      return res.json(toJSON(rows[0], completionDatesMap));
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

      // Log completion for shared repeatable/recurring tasks
      if (newStatus === 'done' && existing.recurrence && existing.recurrence !== 'none') {
        await logCompletion(existing.id, req.userId, existing.recurrence);
      }

      // Notify on status change
      if (newStatus !== existing.status && existing.project_id) {
        const actor = await getUsername(req.userId);
        const verb = newStatus === 'done' ? 'completed' : `moved to ${newStatus}`;
        await notifyProjectMembers(existing.project_id, req.userId, 'task_status',
          `${actor} ${verb} "${existing.title}"`, 'task', id);
      }
    } else {
      // Full edit by owner
      const completedAt = (status === 'done' && existing.status !== 'done') ? new Date().toISOString() :
                          (status !== 'done' ? null : existing.completed_at);
      const completedBy = (status === 'done' && existing.status !== 'done') ? req.userId :
                          (status !== 'done' ? null : existing.completed_by);
      await pool.query(
        `UPDATE tasks SET project_id = $1, title = $2, description = $3, status = $4,
         priority = $5, due_date = $6, custom_fields = $7, recurrence = $8, completed_at = $9, completed_by = $10,
         scheduled_date = $13, task_type = $14
         WHERE id = $11 AND user_id = $12`,
        [projectId || null, title.trim(), description || '', status || 'todo',
         priority || 'medium', dueDate || null, cf, rec, completedAt, completedBy, id, req.userId, scheduledDate || null, taskType || existing.task_type || 'shared']
      );

      // Log completion for shared repeatable/recurring tasks
      if (status === 'done' && existing.status !== 'done' && existing.recurrence && existing.recurrence !== 'none') {
        await logCompletion(existing.id, req.userId, existing.recurrence);
      }

      // Notify on status change by owner
      if (status && status !== existing.status && existing.project_id) {
        const actor = await getUsername(req.userId);
        const verb = status === 'done' ? 'completed' : `moved to ${status}`;
        await notifyProjectMembers(existing.project_id, req.userId, 'task_status',
          `${actor} ${verb} "${existing.title}"`, 'task', id);
      }
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
      `INSERT INTO tasks (id, user_id, project_id, title, description, status, priority, due_date, custom_fields, recurrence, task_type, scheduled_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, req.userId, projectId || null, title.trim(), description || '',
       status || 'todo', priority || 'medium', dueDate || null, cf, rec, taskType || 'shared', scheduledDate || null]
    );

    // Notify project members about new task
    if (projectId) {
      const actor = await getUsername(req.userId);
      await notifyProjectMembers(projectId, req.userId, 'task_created',
        `${actor} created task "${title.trim()}"`, 'task', id);
    }
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
