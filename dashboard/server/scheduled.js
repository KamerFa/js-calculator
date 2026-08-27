import pool, { uid } from './db.js';

/**
 * Check for tasks due tomorrow and send reminder notifications.
 */
async function checkDueTaskReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { rows: tasks } = await pool.query(
    `SELECT t.id, t.title, t.user_id, t.project_id, t.task_type, t.last_reminded_at
     FROM tasks t
     WHERE t.due_date = $1 AND t.status != 'done'
       AND (t.last_reminded_at IS NULL OR t.last_reminded_at < NOW() - INTERVAL '20 hours')`,
    [tomorrowStr]
  );

  for (const task of tasks) {
    if (task.task_type === 'per_member' && task.project_id) {
      // Notify each member
      const { rows: members } = await pool.query(
        'SELECT user_id FROM project_members WHERE project_id = $1',
        [task.project_id]
      );
      for (const m of members) {
        await insertNotification(m.user_id, null, 'task_reminder',
          `"${task.title}" is due tomorrow`, 'task', task.id);
      }
    } else {
      await insertNotification(task.user_id, null, 'task_reminder',
        `"${task.title}" is due tomorrow`, 'task', task.id);
    }

    await pool.query('UPDATE tasks SET last_reminded_at = NOW() WHERE id = $1', [task.id]);
  }
}

/**
 * Check for overdue tasks and send overdue notifications.
 */
async function checkOverdueTasks() {
  const today = new Date().toISOString().split('T')[0];

  const { rows: tasks } = await pool.query(
    `SELECT t.id, t.title, t.user_id, t.project_id, t.task_type, t.last_reminded_at
     FROM tasks t
     WHERE t.due_date < $1 AND t.status != 'done'
       AND t.recurrence = 'none'
       AND (t.last_reminded_at IS NULL OR t.last_reminded_at < NOW() - INTERVAL '24 hours')`,
    [today]
  );

  for (const task of tasks) {
    if (task.task_type === 'per_member' && task.project_id) {
      const { rows: members } = await pool.query(
        'SELECT user_id FROM project_members WHERE project_id = $1',
        [task.project_id]
      );
      for (const m of members) {
        await insertNotification(m.user_id, null, 'task_overdue',
          `"${task.title}" is overdue`, 'task', task.id);
      }
    } else {
      await insertNotification(task.user_id, null, 'task_overdue',
        `"${task.title}" is overdue`, 'task', task.id);
    }

    await pool.query('UPDATE tasks SET last_reminded_at = NOW() WHERE id = $1', [task.id]);
  }
}

/**
 * Check for streak milestones and send notifications.
 * Milestones: 3, 7, 14, 30, 60, 100 days.
 */
async function checkStreakMilestones() {
  const milestones = [3, 7, 14, 30, 60, 100];

  const { rows: tasks } = await pool.query(
    `SELECT t.id, t.title, t.user_id, t.current_streak
     FROM tasks t
     WHERE t.current_streak = ANY($1::int[])
       AND t.recurrence IN ('repeatable', 'daily', 'weekly', 'monthly')`,
    [milestones]
  );

  for (const task of tasks) {
    // Check if we already sent this milestone notification
    const { rows: existing } = await pool.query(
      `SELECT id FROM notifications
       WHERE user_id = $1 AND type = 'streak_milestone' AND target_id = $2
         AND summary LIKE $3 AND created_at > NOW() - INTERVAL '24 hours'`,
      [task.user_id, task.id, `%${task.current_streak}-day%`]
    );

    if (existing.length === 0) {
      await insertNotification(task.user_id, null, 'streak_milestone',
        `${task.current_streak}-day streak on "${task.title}"!`, 'task', task.id);
    }
  }
}

/**
 * Insert a notification, respecting user preferences.
 */
async function insertNotification(userId, actorId, type, summary, targetType, targetId) {
  // Check preferences
  try {
    const { rows } = await pool.query(
      'SELECT notification_preferences FROM users WHERE id = $1',
      [userId]
    );
    if (rows[0]?.notification_preferences) {
      const prefs = JSON.parse(rows[0].notification_preferences || '{}');
      if (prefs[type] === false) return;
    }
  } catch { /* ignore */ }

  await pool.query(
    `INSERT INTO notifications (id, user_id, actor_id, type, summary, target_type, target_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [uid(), userId, actorId, type, summary, targetType || null, targetId || null]
  );
}

/**
 * Auto-reset shared recurring/repeatable tasks that are stale.
 * Runs as a batch SQL update instead of per-request O(n) loop.
 */
async function resetRecurringTasks() {
  const today = new Date().toISOString().split('T')[0];

  // Reset daily + repeatable tasks completed before today
  await pool.query(
    `UPDATE tasks SET status = 'todo', completed_at = NULL, completed_by = NULL
     WHERE recurrence IN ('daily', 'repeatable') AND status = 'done'
       AND task_type = 'shared'
       AND DATE(completed_at) < $1::date`,
    [today]
  );

  // Reset weekly tasks completed 7+ days ago
  await pool.query(
    `UPDATE tasks SET status = 'todo', completed_at = NULL, completed_by = NULL
     WHERE recurrence = 'weekly' AND status = 'done'
       AND task_type = 'shared'
       AND DATE(completed_at) < ($1::date - INTERVAL '7 days')`,
    [today]
  );

  // Reset monthly tasks completed in a previous month
  await pool.query(
    `UPDATE tasks SET status = 'todo', completed_at = NULL, completed_by = NULL
     WHERE recurrence = 'monthly' AND status = 'done'
       AND task_type = 'shared'
       AND (EXTRACT(MONTH FROM completed_at) != EXTRACT(MONTH FROM $1::date)
            OR EXTRACT(YEAR FROM completed_at) != EXTRACT(YEAR FROM $1::date))`,
    [today]
  );
}

export { checkDueTaskReminders, checkOverdueTasks, checkStreakMilestones, resetRecurringTasks };
