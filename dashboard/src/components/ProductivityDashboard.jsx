import { useProductivityData } from './pd/useProductivityData';
import StatsCards from './pd/StatsCards';
import {
  TaskCompletionChart,
  FocusTimeChart,
  TaskStatusDonut,
  PriorityBarChart,
  ProjectActivityChart,
  WeeklyPatternChart,
} from './pd/Charts';

export default function ProductivityDashboard() {
  const { loading, data } = useProductivityData();

  if (loading) {
    return (
      <div className="pd-page">
        <div className="pd-loading">Loading productivity data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pd-page">
        <div className="pd-loading">Could not load data. Try refreshing.</div>
      </div>
    );
  }

  return (
    <div className="pd-page">
      <div className="pd-header">
        <h1>Productivity</h1>
        <p className="pd-header-sub">Your personal analytics overview</p>
      </div>

      <StatsCards score={data.productivityScore} stats={data.stats} />

      {/* Task completions — full width area chart */}
      <div className="pd-chart-card pd-chart-wide">
        <h3 className="pd-chart-title">Task Completions</h3>
        <p className="pd-chart-sub">Last 30 days</p>
        <TaskCompletionChart data={data.completionTimeline} />
      </div>

      {/* Two charts side by side */}
      <div className="pd-chart-row">
        <div className="pd-chart-card">
          <h3 className="pd-chart-title">Task Status</h3>
          <TaskStatusDonut data={data.statusBreakdown} />
        </div>
        <div className="pd-chart-card">
          <h3 className="pd-chart-title">Priority Breakdown</h3>
          <PriorityBarChart data={data.priorityBreakdown} />
        </div>
      </div>

      {/* Focus time — full width */}
      <div className="pd-chart-card pd-chart-wide">
        <h3 className="pd-chart-title">Focus Time</h3>
        <p className="pd-chart-sub">Minutes per day, last 30 days</p>
        <FocusTimeChart data={data.focusTimeline} />
      </div>

      {/* Two charts side by side */}
      <div className="pd-chart-row">
        <div className="pd-chart-card">
          <h3 className="pd-chart-title">Weekly Pattern</h3>
          <p className="pd-chart-sub">Which days you get the most done</p>
          <WeeklyPatternChart data={data.weeklyPattern} />
        </div>
        <div className="pd-chart-card">
          <h3 className="pd-chart-title">Project Activity</h3>
          <p className="pd-chart-sub">Tasks completed per project</p>
          <ProjectActivityChart data={data.projectActivity} />
        </div>
      </div>

      {/* Bottom summary row */}
      <div className="pd-summary-row">
        <div className="pd-summary-item">
          <span className="pd-summary-value">{data.stats.totalDone}</span>
          <span className="pd-summary-label">All-Time Tasks Done</span>
        </div>
        <div className="pd-summary-item">
          <span className="pd-summary-value">{data.stats.totalFocusMinutes}</span>
          <span className="pd-summary-label">Total Focus Time</span>
        </div>
        <div className="pd-summary-item">
          <span className="pd-summary-value">{data.stats.messagesSent}</span>
          <span className="pd-summary-label">Messages This Week</span>
        </div>
      </div>
    </div>
  );
}
