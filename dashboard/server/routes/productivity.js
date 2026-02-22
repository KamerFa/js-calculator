import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// ── GET /productivity/stats — aggregated productivity dashboard data ──
router.get('/stats', async (req, res) => {
  const userId = req.userId;
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Week boundaries (Monday-based)
  const dayOfWeek = now.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - mondayOffset);
  thisWeekStart.setHours(0, 0, 0, 0);
  const thisWeekStr = thisWeekStart.toISOString().split('T')[0];

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekStr = lastWeekStart.toISOString().split('T')[0];

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const thirtyDaysStr = thirtyDaysAgo.toISOString().split('T')[0];

  try {
    const [
      taskOverview,
      completionLog,
      focusTimeline,
      priorityBreakdown,
      messagesThisWeek,
      weeklyPattern,
      projectActivity,
      focusAllTime,
    ] = await Promise.all([
      // 1. Task overview (user's own + shared project tasks)
      pool.query(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE t.status = 'done') AS done,
           COUNT(*) FILTER (WHERE t.status != 'done') AS todo,
           COALESCE(MAX(t.current_streak), 0) AS max_current_streak,
           COALESCE(MAX(t.best_streak), 0) AS max_best_streak
         FROM tasks t
         LEFT JOIN project_members pm ON t.project_id = pm.project_id AND pm.user_id = $1
         WHERE t.user_id = $1 OR pm.user_id = $1`,
        [userId]
      ),

      // 2. Completion log last 30 days (covers both this week + last week + timeline)
      pool.query(
        `SELECT completion_date, COUNT(*) AS count
         FROM task_completion_log
         WHERE user_id = $1 AND completion_date >= $2
         GROUP BY completion_date
         ORDER BY completion_date`,
        [userId, thirtyDaysStr]
      ),

      // 3. Focus timeline last 30 days
      pool.query(
        `SELECT session_date, COUNT(*) AS sessions, COALESCE(SUM(duration), 0) AS total_seconds
         FROM focus_sessions
         WHERE user_id = $1 AND completed_at IS NOT NULL AND session_date >= $2
         GROUP BY session_date
         ORDER BY session_date`,
        [userId, thirtyDaysStr]
      ),

      // 4. Priority breakdown
      pool.query(
        `SELECT COALESCE(t.priority, 'medium') AS priority, COUNT(*) AS count
         FROM tasks t
         LEFT JOIN project_members pm ON t.project_id = pm.project_id AND pm.user_id = $1
         WHERE t.user_id = $1 OR pm.user_id = $1
         GROUP BY t.priority`,
        [userId]
      ),

      // 5. Messages sent this week (DMs + project msgs + group msgs)
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM direct_messages WHERE sender_id = $1 AND created_at >= $2::timestamptz) +
           (SELECT COUNT(*) FROM project_messages WHERE user_id = $1 AND created_at >= $2::timestamptz) +
           (SELECT COUNT(*) FROM group_messages WHERE user_id = $1 AND created_at >= $2::timestamptz)
         AS total`,
        [userId, thisWeekStr]
      ),

      // 6. Weekly pattern (day-of-week distribution, all time)
      pool.query(
        `SELECT EXTRACT(DOW FROM completion_date::date)::int AS dow, COUNT(*) AS count
         FROM task_completion_log
         WHERE user_id = $1
         GROUP BY dow
         ORDER BY dow`,
        [userId]
      ),

      // 7. Project activity
      pool.query(
        `SELECT p.id, p.name, p.color,
           COUNT(DISTINCT t.id) AS total,
           COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'done') AS done
         FROM projects p
         JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
         LEFT JOIN tasks t ON t.project_id = p.id
         GROUP BY p.id, p.name, p.color
         ORDER BY done DESC
         LIMIT 10`,
        [userId]
      ),

      // 8. All-time focus minutes
      pool.query(
        `SELECT COALESCE(SUM(duration), 0) AS total_seconds
         FROM focus_sessions
         WHERE user_id = $1 AND completed_at IS NOT NULL`,
        [userId]
      ),
    ]);

    // Process task overview
    const overview = taskOverview.rows[0];

    // Process completion log into timeline + week buckets
    const completionTimeline = [];
    let thisWeekCompleted = 0;
    let lastWeekCompleted = 0;
    const thisWeekDates = new Set();

    for (const row of completionLog.rows) {
      const date = row.completion_date;
      const count = parseInt(row.count);
      completionTimeline.push({ date, count });

      if (date >= thisWeekStr) {
        thisWeekCompleted += count;
        thisWeekDates.add(date);
      } else if (date >= lastWeekStr && date < thisWeekStr) {
        lastWeekCompleted += count;
      }
    }

    // Fill in missing days for timeline
    const fullTimeline = [];
    for (let i = 30; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = completionTimeline.find((c) => c.date === dateStr);
      fullTimeline.push({ date: dateStr, count: existing ? existing.count : 0 });
    }

    // Process focus timeline
    const focusDays = [];
    let thisWeekFocusSeconds = 0;
    let lastWeekFocusSeconds = 0;
    let thisWeekFocusSessions = 0;

    for (const row of focusTimeline.rows) {
      focusDays.push({
        date: row.session_date,
        minutes: Math.round(parseInt(row.total_seconds) / 60),
        sessions: parseInt(row.sessions),
      });

      if (row.session_date >= thisWeekStr) {
        thisWeekFocusSeconds += parseInt(row.total_seconds);
        thisWeekFocusSessions += parseInt(row.sessions);
      } else if (row.session_date >= lastWeekStr && row.session_date < thisWeekStr) {
        lastWeekFocusSeconds += parseInt(row.total_seconds);
      }
    }

    // Fill in missing days for focus
    const fullFocusTimeline = [];
    for (let i = 30; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = focusDays.find((f) => f.date === dateStr);
      fullFocusTimeline.push({ date: dateStr, minutes: existing ? existing.minutes : 0 });
    }

    // Priority breakdown
    const priorityMap = { high: 0, medium: 0, low: 0 };
    for (const row of priorityBreakdown.rows) {
      if (priorityMap.hasOwnProperty(row.priority)) {
        priorityMap[row.priority] = parseInt(row.count);
      }
    }

    // Weekly pattern (0=Sun through 6=Sat)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const pattern = dayNames.map((day, i) => {
      const row = weeklyPattern.rows.find((r) => parseInt(r.dow) === i);
      return { day, count: row ? parseInt(row.count) : 0 };
    });

    // Project activity
    const projects = projectActivity.rows.map((r) => ({
      name: r.name,
      color: r.color,
      done: parseInt(r.done),
      total: parseInt(r.total),
    }));

    res.json({
      overview: {
        totalTasks: parseInt(overview.total),
        totalDone: parseInt(overview.done),
        totalTodo: parseInt(overview.todo),
        maxCurrentStreak: parseInt(overview.max_current_streak),
        maxBestStreak: parseInt(overview.max_best_streak),
        totalFocusMinutes: Math.round(parseInt(focusAllTime.rows[0].total_seconds) / 60),
      },
      thisWeek: {
        tasksCompleted: thisWeekCompleted,
        focusMinutes: Math.round(thisWeekFocusSeconds / 60),
        focusSessions: thisWeekFocusSessions,
        activeDays: thisWeekDates.size,
      },
      lastWeek: {
        tasksCompleted: lastWeekCompleted,
        focusMinutes: Math.round(lastWeekFocusSeconds / 60),
      },
      completionTimeline: fullTimeline,
      focusTimeline: fullFocusTimeline,
      priorityBreakdown: [
        { name: 'High', count: priorityMap.high, fill: '#ec4899' },
        { name: 'Medium', count: priorityMap.medium, fill: '#f59e0b' },
        { name: 'Low', count: priorityMap.low, fill: '#5b9aef' },
      ],
      statusBreakdown: [
        { name: 'Done', value: parseInt(overview.done), fill: '#22c55e' },
        { name: 'To Do', value: parseInt(overview.todo), fill: '#5b9aef' },
      ],
      projectActivity: projects,
      weeklyPattern: pattern,
      messagesSentThisWeek: parseInt(messagesThisWeek.rows[0].total),
    });
  } catch (err) {
    console.error('Productivity stats error:', err.message);
    res.status(500).json({ error: 'Failed to load productivity stats' });
  }
});

export default router;
