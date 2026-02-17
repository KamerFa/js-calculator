import { useState, useMemo } from 'react';
import { IconPlus } from './Icons';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function CalendarView({ tasks, projects, onToggle, onTaskClick, onEdit, onDelete, onProjectClick, onNewTask }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const totalDays = lastDay.getDate();

  // Build a map: 'YYYY-MM-DD' -> [tasks]
  // For recurring tasks, create date-specific copies with correct completion status
  const tasksByDate = useMemo(() => {
    const map = {};

    // Helper: create a date-specific copy of a recurring task
    const withDateStatus = (task, dateStr) => {
      const completionDates = task.completionDates || [];
      const isDoneOnDate = completionDates.includes(dateStr);
      // For shared recurring tasks, check completedAt date
      const isSharedDoneOnDate = task.taskType === 'shared' && task.completedAt &&
        new Date(task.completedAt).toISOString().split('T')[0] === dateStr;
      const done = isDoneOnDate || isSharedDoneOnDate;
      return {
        ...task,
        status: done ? 'done' : 'todo',
        _calendarDate: dateStr, // track which date this copy represents
      };
    };

    for (const t of tasks) {
      if (!t.dueDate) continue;
      if (!map[t.dueDate]) map[t.dueDate] = [];
      // For recurring tasks with a due date, also apply per-date status
      if (t.recurrence && t.recurrence !== 'none') {
        map[t.dueDate].push(withDateStatus(t, t.dueDate));
      } else {
        map[t.dueDate].push(t);
      }
    }

    // Spread recurring tasks (no due date) across the visible month
    const recurringTasks = tasks.filter((t) => !t.dueDate && t.recurrence && t.recurrence !== 'none');
    if (recurringTasks.length > 0) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        for (const t of recurringTasks) {
          // Check if task's project has date bounds and if this date is within them
          const project = projects.find((p) => p.id === t.projectId);
          if (project?.startDate && ds < project.startDate) continue;
          if (project?.endDate && ds > project.endDate) continue;

          const shouldShow =
            t.recurrence === 'daily' ||
            (t.recurrence === 'weekly' && (d === 1 || d % 7 === 1)) ||
            (t.recurrence === 'monthly' && d === 1);

          if (shouldShow) {
            if (!map[ds]) map[ds] = [];
            map[ds].push(withDateStatus(t, ds));
          }
        }
      }
    }

    return map;
  }, [tasks, projects, year, month]);

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
    setSelectedDate(null);
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(today.toISOString().split('T')[0]);
  };

  const dateStr = (day) => {
    if (!day) return null;
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const selectedTasks = selectedDate ? (tasksByDate[selectedDate] || []) : [];
  const getProject = (id) => projects.find((p) => p.id === id);

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  };

  const REC_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Calendar</h1>
            <p className="subtitle">Tasks by due date</p>
          </div>
          <button className="btn btn-primary" onClick={() => onNewTask()}>
            <IconPlus /> New Task
          </button>
        </div>
      </div>

      {/* Calendar nav */}
      <div className="cal-nav">
        <button className="btn btn-sm" onClick={prevMonth}>&larr;</button>
        <h2 className="cal-month-label">{MONTH_NAMES[month]} {year}</h2>
        <button className="btn btn-sm" onClick={nextMonth}>&rarr;</button>
        <button className="btn btn-sm cal-today-btn" onClick={goToday}>Today</button>
      </div>

      {/* Day headers */}
      <div className="cal-grid">
        {DAYS.map((d) => (
          <div className="cal-day-header" key={d}>{d}</div>
        ))}

        {/* Calendar cells */}
        {cells.map((day, i) => {
          if (day === null) return <div className="cal-cell empty" key={`pad-${i}`} />;
          const ds = dateStr(day);
          const dayTasks = tasksByDate[ds] || [];
          const isToday = sameDay(new Date(year, month, day), today);
          const isSelected = selectedDate === ds;
          const hasTasks = dayTasks.length > 0;
          const allDone = hasTasks && dayTasks.every((t) => t.status === 'done');
          const hasOverdue = hasTasks && dayTasks.some((t) => t.status !== 'done') &&
            new Date(ds) < new Date(today.toISOString().split('T')[0]);

          return (
            <div
              key={ds}
              className={`cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${hasOverdue ? ' overdue' : ''}`}
              onClick={() => setSelectedDate(ds)}
            >
              <span className="cal-day-num">{day}</span>
              {hasTasks && (
                <div className="cal-dots">
                  {dayTasks.slice(0, 3).map((t) => (
                    <span
                      key={t.id}
                      className={`cal-dot${t.status === 'done' ? ' done' : ''}`}
                      style={{ background: t.status === 'done' ? 'var(--success)' : (getProject(t.projectId)?.color || 'var(--accent)') }}
                    />
                  ))}
                  {dayTasks.length > 3 && <span className="cal-dot-more">+{dayTasks.length - 3}</span>}
                </div>
              )}
              {allDone && <span className="cal-check-mark">&#10003;</span>}
            </div>
          );
        })}
      </div>

      {/* Selected date panel */}
      {selectedDate && (
        <div className="cal-detail-panel">
          <h3 className="cal-detail-date">{formatDate(selectedDate)}</h3>
          {selectedTasks.length === 0 ? (
            <div className="empty-state">No tasks on this date.</div>
          ) : (
            <div className="cal-detail-tasks">
              {selectedTasks.map((task) => {
                const project = getProject(task.projectId);
                return (
                  <div className="cal-task-row" key={`${task.id}-${selectedDate}`} onClick={() => onTaskClick(task)}>
                    <div
                      className={`task-checkbox${task.status === 'done' ? ' checked' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onToggle(task, task._calendarDate || selectedDate); }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className={`task-title${task.status === 'done' ? ' done' : ''}`}>{task.title}</span>
                    {task.recurrence && task.recurrence !== 'none' && (
                      <span className="recurrence-badge">{REC_LABELS[task.recurrence]}</span>
                    )}
                    {project && (
                      <span
                        className="project-tag"
                        style={{ background: project.color + '18', color: project.color }}
                        onClick={(e) => { e.stopPropagation(); onProjectClick(project.id); }}
                      >
                        {project.name}
                      </span>
                    )}
                    <span className={`priority-badge ${task.priority}`}>{task.priority}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
