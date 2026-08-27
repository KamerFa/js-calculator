import { useState, useEffect } from 'react';
import { DB } from '../../db';

export function useProductivityData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    DB.getProductivityStats()
      .then((raw) => {
        // Week-over-week trend percentages
        const taskTrend = raw.lastWeek.tasksCompleted > 0
          ? Math.round(((raw.thisWeek.tasksCompleted - raw.lastWeek.tasksCompleted) / raw.lastWeek.tasksCompleted) * 100)
          : raw.thisWeek.tasksCompleted > 0 ? 100 : 0;

        const focusTrend = raw.lastWeek.focusMinutes > 0
          ? Math.round(((raw.thisWeek.focusMinutes - raw.lastWeek.focusMinutes) / raw.lastWeek.focusMinutes) * 100)
          : raw.thisWeek.focusMinutes > 0 ? 100 : 0;

        // Best day from weekly pattern
        const bestDay = raw.weeklyPattern.reduce((best, d) => d.count > best.count ? d : best, { day: '-', count: 0 });

        setData({ ...raw, taskTrend, focusTrend, bestDay });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { loading, data };
}

export function formatMinutes(m) {
  if (!m || m === 0) return '0m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}
