import { formatMinutes } from './useProductivityData';

function TrendBadge({ value }) {
  if (value === 0) return null;
  const up = value > 0;
  return (
    <span className={`pd-trend ${up ? 'pd-trend-up' : 'pd-trend-down'}`}>
      {up ? '\u2191' : '\u2193'} {Math.abs(value)}%
    </span>
  );
}

function ScoreRing({ score }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="pd-score-ring">
      <svg viewBox="0 0 100 100" width="96" height="96">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="6" opacity="0.3" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke="url(#scoreGrad)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <div className="pd-score-value">{score}</div>
    </div>
  );
}

export default function StatsCards({ data }) {
  const { level, productivityScore, thisWeek, overview, taskTrend, focusTrend, bestDay } = data;

  return (
    <>
      {/* XP / Level bar */}
      <div className="pd-level-bar">
        <div className="pd-level-info">
          <span className="pd-level-badge">Lv.{level.level}</span>
          <span className="pd-level-title">{level.title}</span>
          <span className="pd-level-xp">{level.currentXP} XP</span>
        </div>
        <div className="pd-level-track">
          <div className="pd-level-fill" style={{ width: `${Math.round(level.progress * 100)}%` }} />
        </div>
        <span className="pd-level-remaining">{level.levelXP} / {level.levelTarget} to next level</span>
      </div>

      {/* Stat cards */}
      <div className="pd-stats-row">
        <div className="pd-stat-card pd-stat-score">
          <ScoreRing score={productivityScore} />
          <div className="pd-stat-meta">
            <span className="pd-stat-label">Score</span>
            <span className="pd-stat-sublabel">This week</span>
          </div>
        </div>

        <div className="pd-stat-card">
          <span className="pd-stat-value pd-color-green">{thisWeek.tasksCompleted}</span>
          <span className="pd-stat-label">Tasks Done</span>
          <TrendBadge value={taskTrend} />
        </div>

        <div className="pd-stat-card">
          <span className="pd-stat-value pd-color-purple">{formatMinutes(thisWeek.focusMinutes)}</span>
          <span className="pd-stat-label">Focus Time</span>
          <TrendBadge value={focusTrend} />
        </div>

        <div className="pd-stat-card">
          <span className="pd-stat-value pd-color-pink">{overview.maxBestStreak}d</span>
          <span className="pd-stat-label">Best Streak</span>
          {overview.maxCurrentStreak > 0 && (
            <span className="pd-trend pd-trend-up">{overview.maxCurrentStreak}d active</span>
          )}
        </div>

        <div className="pd-stat-card">
          <span className="pd-stat-value pd-color-blue">{thisWeek.activeDays}<span className="pd-stat-suffix">/7</span></span>
          <span className="pd-stat-label">Active Days</span>
          <span className="pd-stat-sublabel">Best: {bestDay.day}</span>
        </div>
      </div>
    </>
  );
}
