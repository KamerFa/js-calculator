import { useState, useEffect, useMemo } from 'react';
import { DB } from '../../db';

export function useProductivityData() {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    DB.getProductivityStats()
      .then(setRaw)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const data = useMemo(() => {
    if (!raw) return null;

    // Productivity Score (0-100)
    const taskVelocity = Math.min(raw.thisWeek.tasksCompleted / 10, 1) * 40;
    const focusConsistency = Math.min(raw.thisWeek.focusSessions / 5, 1) * 25;
    const streakHealth = raw.overview.maxCurrentStreak > 0 ? 20 : 0;
    const activeDaysScore = (raw.thisWeek.activeDays / 7) * 15;
    const productivityScore = Math.round(taskVelocity + focusConsistency + streakHealth + activeDaysScore);

    // Week-over-week trends
    const taskTrend = raw.lastWeek.tasksCompleted > 0
      ? Math.round(((raw.thisWeek.tasksCompleted - raw.lastWeek.tasksCompleted) / raw.lastWeek.tasksCompleted) * 100)
      : raw.thisWeek.tasksCompleted > 0 ? 100 : 0;

    const focusTrend = raw.lastWeek.focusMinutes > 0
      ? Math.round(((raw.thisWeek.focusMinutes - raw.lastWeek.focusMinutes) / raw.lastWeek.focusMinutes) * 100)
      : raw.thisWeek.focusMinutes > 0 ? 100 : 0;

    // Format focus time
    const formatMinutes = (m) => {
      if (m < 60) return `${m}m`;
      const h = Math.floor(m / 60);
      const rem = m % 60;
      return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
    };

    // Best day
    const bestDay = raw.weeklyPattern.reduce((best, d) => d.count > best.count ? d : best, { day: '-', count: 0 });

    return {
      productivityScore,
      stats: {
        tasksThisWeek: raw.thisWeek.tasksCompleted,
        taskTrend,
        focusThisWeek: formatMinutes(raw.thisWeek.focusMinutes),
        focusTrend,
        bestStreak: raw.overview.maxBestStreak,
        currentStreak: raw.overview.maxCurrentStreak,
        activeDays: raw.thisWeek.activeDays,
        totalDone: raw.overview.totalDone,
        totalFocusMinutes: formatMinutes(raw.overview.totalFocusMinutes),
        messagesSent: raw.messagesSentThisWeek,
        bestDay: bestDay.day,
      },
      completionTimeline: raw.completionTimeline,
      focusTimeline: raw.focusTimeline,
      statusBreakdown: raw.statusBreakdown,
      priorityBreakdown: raw.priorityBreakdown,
      projectActivity: raw.projectActivity,
      weeklyPattern: raw.weeklyPattern,
    };
  }, [raw]);

  return { loading, data };
}
