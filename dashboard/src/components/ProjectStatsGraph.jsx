import { useState, useEffect } from 'react';
import { DB } from '../db';

export default function ProjectStatsGraph({ projectId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      DB.getProjectStats(projectId)
        .then(setStats)
        .catch(() => setStats(null))
        .finally(() => setLoading(false));
    }
  }, [projectId]);

  if (loading) return <div className="project-stats-graph loading">Loading stats...</div>;
  if (!stats || !stats.completions || stats.completions.length === 0) {
    return <div className="project-stats-graph empty">No completion history yet</div>;
  }

  const completions = stats.completions;
  const maxCount = Math.max(...completions.map((c) => c.count));
  const totalDone = completions.reduce((sum, c) => sum + c.count, 0);

  // Group by week for better visualization if we have many days
  const groupByWeek = completions.length > 30;

  let data = completions;
  if (groupByWeek) {
    const weekMap = {};
    completions.forEach((c) => {
      const date = new Date(c.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split('T')[0];
      weekMap[weekKey] = (weekMap[weekKey] || 0) + c.count;
    });
    data = Object.entries(weekMap).map(([date, count]) => ({ date, count }));
    data.sort((a, b) => a.date.localeCompare(b.date));
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    if (groupByWeek) {
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      return `${month} ${day}`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="project-stats-graph">
      <div className="project-stats-summary">
        <div className="stat-item">
          <span className="stat-label">Total Completed</span>
          <span className="stat-value">{totalDone}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Days Active</span>
          <span className="stat-value">{completions.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Avg Per Day</span>
          <span className="stat-value">{(totalDone / completions.length).toFixed(1)}</span>
        </div>
      </div>

      <div className="graph-container">
        <div className="graph-title">{groupByWeek ? 'Weekly' : 'Daily'} Completion Frequency</div>
        <div className="graph-bars">
          {data.map((item, idx) => (
            <div className="graph-bar-wrapper" key={idx}>
              <div className="graph-bar-container">
                <div
                  className="graph-bar"
                  style={{ height: `${(item.count / maxCount) * 100}%` }}
                  title={`${formatDate(item.date)}: ${item.count} task${item.count !== 1 ? 's' : ''}`}
                >
                  <span className="graph-bar-count">{item.count}</span>
                </div>
              </div>
              <div className="graph-bar-label">{formatDate(item.date)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
