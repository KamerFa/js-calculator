import { useTranslation } from '../i18n';
import { getProjectTimeInfo } from '../projectStatus';
import { formatDate } from '../utils/time';

export default function ProjectCompletionSummary({ project, tasks }) {
  const { t } = useTranslation();
  const timeInfo = getProjectTimeInfo(project);

  const projectTasks = tasks.filter((tk) => tk.projectId === project.id);
  const total = projectTasks.length;
  const done = projectTasks.filter((tk) => tk.status === 'done').length;
  const inProgress = projectTasks.filter((tk) => tk.status === 'in-progress').length;
  const todo = projectTasks.filter((tk) => tk.status === 'todo').length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  // Calculate project duration
  const start = new Date(project.startDate);
  const end = new Date(project.endDate);
  const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  // Group completed tasks by date for the chart
  const completionsByDate = {};
  projectTasks
    .filter((tk) => tk.status === 'done' && tk.updatedAt)
    .forEach((tk) => {
      const date = new Date(tk.updatedAt).toISOString().split('T')[0];
      completionsByDate[date] = (completionsByDate[date] || 0) + 1;
    });

  const chartData = Object.entries(completionsByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const maxCount = chartData.length > 0 ? Math.max(...chartData.map((d) => d.count)) : 1;

  return (
    <div className="completion-summary">
      <div className="completion-summary-header">
        <h3>{t('projectStatus.completionSummary')}</h3>
        {timeInfo?.type === 'elapsed' && (
          <span className="completion-elapsed">
            {t('projectStatus.endedAgo', { days: timeInfo.days })}
          </span>
        )}
      </div>

      <div className="completion-stats-grid">
        <div className="completion-stat">
          <div className="completion-stat-value">{completionRate}%</div>
          <div className="completion-stat-label">{t('projectStatus.completionRate')}</div>
        </div>
        <div className="completion-stat">
          <div className="completion-stat-value">{done}<span className="completion-stat-total">/{total}</span></div>
          <div className="completion-stat-label">{t('projectStatus.tasksCompleted')}</div>
        </div>
        <div className="completion-stat">
          <div className="completion-stat-value">{durationDays}</div>
          <div className="completion-stat-label">{t('projectStatus.durationDays')}</div>
        </div>
        <div className="completion-stat">
          <div className="completion-stat-value">{todo + inProgress}</div>
          <div className="completion-stat-label">{t('projectStatus.remaining')}</div>
        </div>
      </div>

      {/* Donut-style completion ring */}
      <div className="completion-ring-row">
        <div className="completion-ring">
          <svg viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="8" />
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke={completionRate === 100 ? '#22c55e' : 'var(--primary)'}
              strokeWidth="8"
              strokeDasharray={`${(completionRate / 100) * 213.6} 213.6`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
            />
          </svg>
          <span className="completion-ring-label">{completionRate}%</span>
        </div>
        <div className="completion-breakdown">
          <div className="completion-bar-row">
            <span className="cb-dot" style={{ background: '#22c55e' }} />
            <span className="cb-label">{t('tasks.done')}</span>
            <span className="cb-count">{done}</span>
          </div>
          <div className="completion-bar-row">
            <span className="cb-dot" style={{ background: '#eab308' }} />
            <span className="cb-label">{t('tasks.inProgress')}</span>
            <span className="cb-count">{inProgress}</span>
          </div>
          <div className="completion-bar-row">
            <span className="cb-dot" style={{ background: '#94a3b8' }} />
            <span className="cb-label">{t('tasks.todo')}</span>
            <span className="cb-count">{todo}</span>
          </div>
        </div>
      </div>

      {/* Completion timeline chart */}
      {chartData.length > 0 && (
        <div className="completion-chart">
          <div className="completion-chart-title">{t('projectStatus.completionTimeline')}</div>
          <div className="completion-chart-bars">
            {chartData.map((item, idx) => (
              <div className="completion-chart-bar-wrapper" key={idx}>
                <div className="completion-chart-bar-container">
                  <div
                    className="completion-chart-bar"
                    style={{ height: `${(item.count / maxCount) * 100}%` }}
                    title={`${formatDate(item.date)}: ${item.count}`}
                  >
                    <span className="completion-chart-bar-count">{item.count}</span>
                  </div>
                </div>
                <div className="completion-chart-bar-label">{formatDate(item.date)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
