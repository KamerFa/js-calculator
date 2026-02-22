/* ═══════════════════════════════════════════════════════════
   STAT CARDS — Hero score + 4 metric cards with trends
   ═══════════════════════════════════════════════════════════ */

function TrendBadge({ value }) {
  if (value === 0) return <span className="pd-trend pd-trend-flat">-</span>;
  const up = value > 0;
  return (
    <span className={`pd-trend ${up ? 'pd-trend-up' : 'pd-trend-down'}`}>
      {up ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  );
}

function ScoreRing({ score }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="pd-score-ring">
      <svg viewBox="0 0 100 100" width="96" height="96">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border)" strokeWidth="6" opacity="0.3" />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke="url(#scoreGradient)" strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <div className="pd-score-value">{score}</div>
    </div>
  );
}

export default function StatsCards({ score, stats }) {
  return (
    <div className="pd-stats-row">
      {/* Score card — larger */}
      <div className="pd-stat-card pd-stat-score">
        <ScoreRing score={score} />
        <div className="pd-stat-meta">
          <span className="pd-stat-label">Productivity Score</span>
          <span className="pd-stat-sublabel">This week</span>
        </div>
      </div>

      {/* Tasks done */}
      <div className="pd-stat-card">
        <div className="pd-stat-icon pd-accent-green">✓</div>
        <span className="pd-stat-value pd-color-green">{stats.tasksThisWeek}</span>
        <span className="pd-stat-label">Tasks Done</span>
        <TrendBadge value={stats.taskTrend} />
      </div>

      {/* Focus time */}
      <div className="pd-stat-card">
        <div className="pd-stat-icon pd-accent-purple">◎</div>
        <span className="pd-stat-value pd-color-purple">{stats.focusThisWeek}</span>
        <span className="pd-stat-label">Focus Time</span>
        <TrendBadge value={stats.focusTrend} />
      </div>

      {/* Best streak */}
      <div className="pd-stat-card">
        <div className="pd-stat-icon pd-accent-pink">♦</div>
        <span className="pd-stat-value pd-color-pink">{stats.bestStreak}d</span>
        <span className="pd-stat-label">Best Streak</span>
        {stats.currentStreak > 0 && (
          <span className="pd-trend pd-trend-up">🔥 {stats.currentStreak}d active</span>
        )}
      </div>

      {/* Active days */}
      <div className="pd-stat-card">
        <div className="pd-stat-icon pd-accent-blue">◆</div>
        <span className="pd-stat-value pd-color-blue">{stats.activeDays}/7</span>
        <span className="pd-stat-label">Active Days</span>
        <span className="pd-stat-sublabel">Best: {stats.bestDay}</span>
      </div>
    </div>
  );
}
