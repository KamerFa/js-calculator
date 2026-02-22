import { useState, useEffect } from 'react';
import { DB } from '../db';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

const PdTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="pd-tooltip">
      <div className="pd-tooltip-label">{label}</div>
      {payload.map((p, i) => (
        <div className="pd-tooltip-value" key={i} style={{ color: p.color || p.fill }}>
          {p.value} {p.name}
        </div>
      ))}
    </div>
  );
};

export default function ProjectProductivityStats({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    DB.getProjectProductivityStats(projectId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div className="pps-loading">Loading stats...</div>;
  if (!data) return null;

  const { overview, completionTimeline, effortBreakdown, priorityBreakdown, xpEarned, avgCompletionDays } = data;
  const completionPct = overview.total > 0 ? Math.round((overview.done / overview.total) * 100) : 0;

  // Filter out zero-count entries for donuts
  const effortData = effortBreakdown.filter(e => e.count > 0);
  const priorityData = priorityBreakdown.filter(p => p.count > 0);

  return (
    <div className="pps">
      <div className="pps-header">
        <h3 className="pps-title">Project Analytics</h3>
      </div>

      {/* Quick stat pills */}
      <div className="pps-pills">
        <div className="pps-pill">
          <span className="pps-pill-value">{overview.done}<span className="pps-pill-dim">/{overview.total}</span></span>
          <span className="pps-pill-label">Completed</span>
        </div>
        <div className="pps-pill">
          <span className="pps-pill-value">{completionPct}<span className="pps-pill-dim">%</span></span>
          <span className="pps-pill-label">Progress</span>
        </div>
        <div className="pps-pill">
          <span className="pps-pill-value">{overview.inProgress}</span>
          <span className="pps-pill-label">In Progress</span>
        </div>
        <div className="pps-pill">
          <span className="pps-pill-value">{xpEarned}</span>
          <span className="pps-pill-label">XP Earned</span>
        </div>
        {avgCompletionDays != null && (
          <div className="pps-pill">
            <span className="pps-pill-value">{avgCompletionDays}<span className="pps-pill-dim">d</span></span>
            <span className="pps-pill-label">Avg Time</span>
          </div>
        )}
        {overview.bestStreak > 0 && (
          <div className="pps-pill">
            <span className="pps-pill-value">{overview.bestStreak}</span>
            <span className="pps-pill-label">Best Streak</span>
          </div>
        )}
      </div>

      {/* Completion timeline (area chart) */}
      {completionTimeline.some(d => d.count > 0) && (
        <div className="pps-chart">
          <div className="pps-chart-label">30-day completions</div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={completionTimeline} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="ppsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
              <XAxis dataKey="date" hide />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-2)' }} width={30} />
              <Tooltip content={<PdTooltip />} />
              <Area type="monotone" dataKey="count" name="tasks" stroke="#22c55e" fill="url(#ppsGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bottom row: Effort + Priority donuts */}
      {(effortData.length > 0 || priorityData.length > 0) && (
        <div className="pps-donuts">
          {effortData.length > 0 && (
            <div className="pps-donut-card">
              <div className="pps-chart-label">Effort</div>
              <ResponsiveContainer width="100%" height={100}>
                <PieChart>
                  <Pie data={effortData} dataKey="count" nameKey="name" cx="50%" cy="50%"
                    innerRadius={28} outerRadius={42} paddingAngle={3} strokeWidth={0}>
                    {effortData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip content={<PdTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pps-donut-legend">
                {effortData.map(e => (
                  <span key={e.name} className="pps-legend-item">
                    <span className="pps-legend-dot" style={{ background: e.fill }} />{e.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {priorityData.length > 0 && (
            <div className="pps-donut-card">
              <div className="pps-chart-label">Priority</div>
              <ResponsiveContainer width="100%" height={100}>
                <PieChart>
                  <Pie data={priorityData} dataKey="count" nameKey="name" cx="50%" cy="50%"
                    innerRadius={28} outerRadius={42} paddingAngle={3} strokeWidth={0}>
                    {priorityData.map((p, i) => <Cell key={i} fill={p.fill} />)}
                  </Pie>
                  <Tooltip content={<PdTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pps-donut-legend">
                {priorityData.map(p => (
                  <span key={p.name} className="pps-legend-item">
                    <span className="pps-legend-dot" style={{ background: p.fill }} />{p.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
