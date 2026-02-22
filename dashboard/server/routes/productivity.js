import { Router } from 'express';
import pool from '../db.js';
import { getLevelProgress, ACHIEVEMENTS } from '../gamification.js';

const router = Router();

router.get('/stats', async (req, res) => {
  const userId = req.userId;
  const now = new Date();

  // Week boundaries (Monday-based)
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - mondayOffset);
  thisWeekStart.setHours(0, 0, 0, 0);
  const thisWeekStr = thisWeekStart.toISOString().split('T')[0];

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekStr = lastWeekStart.toISOString().split('T')[0];

  const d30 = new Date(now);
  d30.setDate(now.getDate() - 30);
  const d30Str = d30.toISOString().split('T')[0];

  try {
    const [
      userRow,
      taskOverview,
      completionLog30d,
      focusTimeline30d,
      priorityBreakdown,
      messagesThisWeek,
      weeklyPattern,
      projectActivity,
      achievements,
      xpHistory,
      focusAllTime,
    ] = await Promise.all([
      pool.query(`SELECT xp, level FROM users WHERE id = $1`, [userId]),

      pool.query(`
        SELECT
          COUNT(DISTINCT t.id) as total,
          COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'done') as done,
          COUNT(DISTINCT t.id) FILTER (WHERE t.status != 'done') as todo,
          COALESCE(MAX(t.current_streak), 0) as max_current_streak,
          COALESCE(MAX(t.best_streak), 0) as max_best_streak
        FROM tasks t
        LEFT JOIN project_members pm ON t.project_id = pm.project_id AND pm.user_id = $1
        WHERE t.user_id = $1 OR pm.user_id = $1
      `, [userId]),

      pool.query(`
        SELECT completion_date, COUNT(*) as count
        FROM task_completion_log
        WHERE user_id = $1 AND completion_date >= $2
        GROUP BY completion_date ORDER BY completion_date
      `, [userId, d30Str]),

      pool.query(`
        SELECT session_date, COUNT(*) as sessions, COALESCE(SUM(duration), 0) as total_seconds
        FROM focus_sessions
        WHERE user_id = $1 AND completed_at IS NOT NULL AND session_date >= $2
        GROUP BY session_date ORDER BY session_date
      `, [userId, d30Str]),

      pool.query(`
        SELECT COALESCE(t.priority, 'medium') as priority, COUNT(DISTINCT t.id) as count
        FROM tasks t
        LEFT JOIN project_members pm ON t.project_id = pm.project_id AND pm.user_id = $1
        WHERE t.user_id = $1 OR pm.user_id = $1
        GROUP BY t.priority
      `, [userId]),

      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM direct_messages WHERE sender_id = $1 AND created_at >= $2::timestamptz) +
          (SELECT COUNT(*) FROM project_messages WHERE user_id = $1 AND created_at >= $2::timestamptz) +
          (SELECT COUNT(*) FROM group_messages WHERE user_id = $1 AND created_at >= $2::timestamptz) as total
      `, [userId, thisWeekStart.toISOString()]),

      pool.query(`
        SELECT EXTRACT(DOW FROM completion_date::date)::int as dow, COUNT(*) as count
        FROM task_completion_log WHERE user_id = $1
        GROUP BY dow ORDER BY dow
      `, [userId]),

      pool.query(`
        SELECT p.name, p.color,
          COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'done') as done,
          COUNT(DISTINCT t.id) as total
        FROM projects p
        JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
        LEFT JOIN tasks t ON t.project_id = p.id
        GROUP BY p.id, p.name, p.color
        HAVING COUNT(DISTINCT t.id) > 0
        ORDER BY COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'done') DESC
        LIMIT 10
      `, [userId]),

      pool.query(`
        SELECT achievement_id, unlocked_at
        FROM user_achievements WHERE user_id = $1
        ORDER BY unlocked_at DESC
      `, [userId]),

      pool.query(`
        SELECT created_at::date as date, SUM(amount) as total
        FROM xp_log WHERE user_id = $1 AND created_at >= $2::date
        GROUP BY created_at::date ORDER BY date
      `, [userId, d30Str]),

      pool.query(`
        SELECT COALESCE(SUM(duration), 0) as total_seconds
        FROM focus_sessions WHERE user_id = $1 AND completed_at IS NOT NULL
      `, [userId]),
    ]);

    const user = userRow.rows[0] || { xp: 0, level: 1 };
    const ov = taskOverview.rows[0];

    // This week / last week splits
    let thisWeekTasks = 0, lastWeekTasks = 0;
    const thisWeekDates = new Set();
    const completionTimeline = [];

    for (const row of completionLog30d.rows) {
      const count = parseInt(row.count);
      completionTimeline.push({ date: row.completion_date, count });
      if (row.completion_date >= thisWeekStr) {
        thisWeekTasks += count;
        thisWeekDates.add(row.completion_date);
      } else if (row.completion_date >= lastWeekStr) {
        lastWeekTasks += count;
      }
    }

    // Fill in missing days
    const fullTimeline = [];
    for (let i = 30; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = completionTimeline.find((c) => c.date === dateStr);
      fullTimeline.push({ date: dateStr, count: existing ? existing.count : 0 });
    }

    // Focus this/last week
    let thisWeekFocusSec = 0, lastWeekFocusSec = 0, thisWeekFocusSessions = 0;
    const focusDays = [];
    for (const row of focusTimeline30d.rows) {
      const secs = parseInt(row.total_seconds);
      const sessions = parseInt(row.sessions);
      focusDays.push({ date: row.session_date, minutes: Math.round(secs / 60), sessions });
      if (row.session_date >= thisWeekStr) {
        thisWeekFocusSec += secs;
        thisWeekFocusSessions += sessions;
      } else if (row.session_date >= lastWeekStr) {
        lastWeekFocusSec += secs;
      }
    }

    const fullFocusTimeline = [];
    for (let i = 30; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = focusDays.find((f) => f.date === dateStr);
      fullFocusTimeline.push({ date: dateStr, minutes: existing ? existing.minutes : 0 });
    }

    // Level progress
    const levelProgress = getLevelProgress(parseInt(user.xp) || 0);

    // Achievements
    const unlockedIds = new Set(achievements.rows.map((r) => r.achievement_id));
    const allAchievements = ACHIEVEMENTS.map((a) => ({
      id: a.id, name: a.name, desc: a.desc, icon: a.icon, xp: a.xp,
      unlocked: unlockedIds.has(a.id),
      unlockedAt: achievements.rows.find((r) => r.achievement_id === a.id)?.unlocked_at || null,
    }));

    // Weekly pattern
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const patternMap = {};
    for (const row of weeklyPattern.rows) patternMap[parseInt(row.dow)] = parseInt(row.count);
    const weeklyPatternFull = dayNames.map((name, i) => ({ day: name, count: patternMap[i] || 0 }));

    // Priority
    const priorityMap = { high: 0, medium: 0, low: 0 };
    for (const row of priorityBreakdown.rows) {
      if (Object.hasOwn(priorityMap, row.priority)) priorityMap[row.priority] = parseInt(row.count);
    }

    // Productivity score
    const maxStreak = parseInt(ov.max_current_streak || 0);
    const score = Math.round(
      Math.min(thisWeekTasks / 10, 1) * 40 +
      Math.min(thisWeekFocusSessions / 5, 1) * 25 +
      (maxStreak > 0 ? 20 : 0) +
      (thisWeekDates.size / 7) * 15
    );

    res.json({
      level: levelProgress,
      productivityScore: score,
      overview: {
        totalTasks: parseInt(ov.total),
        totalDone: parseInt(ov.done),
        totalTodo: parseInt(ov.todo),
        maxCurrentStreak: maxStreak,
        maxBestStreak: parseInt(ov.max_best_streak || 0),
        totalFocusMinutes: Math.round(parseInt(focusAllTime.rows[0].total_seconds) / 60),
      },
      thisWeek: {
        tasksCompleted: thisWeekTasks,
        focusMinutes: Math.round(thisWeekFocusSec / 60),
        focusSessions: thisWeekFocusSessions,
        activeDays: thisWeekDates.size,
        messagesSent: parseInt(messagesThisWeek.rows[0].total),
      },
      lastWeek: {
        tasksCompleted: lastWeekTasks,
        focusMinutes: Math.round(lastWeekFocusSec / 60),
      },
      completionTimeline: fullTimeline,
      focusTimeline: fullFocusTimeline,
      xpTimeline: xpHistory.rows.map((r) => ({
        date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date,
        xp: parseInt(r.total),
      })),
      priorityBreakdown: [
        { name: 'High', count: priorityMap.high, fill: '#ec4899' },
        { name: 'Medium', count: priorityMap.medium, fill: '#f59e0b' },
        { name: 'Low', count: priorityMap.low, fill: '#5b9aef' },
      ],
      statusBreakdown: [
        { name: 'Done', value: parseInt(ov.done), fill: '#22c55e' },
        { name: 'To Do', value: parseInt(ov.todo), fill: '#5b9aef' },
      ],
      projectActivity: projectActivity.rows.map((r) => ({
        name: r.name, done: parseInt(r.done), total: parseInt(r.total), color: r.color,
      })),
      weeklyPattern: weeklyPatternFull,
      achievements: allAchievements,
    });
  } catch (err) {
    console.error('Productivity stats error:', err.message);
    res.status(500).json({ error: 'Failed to load productivity stats' });
  }
});

export default router;
