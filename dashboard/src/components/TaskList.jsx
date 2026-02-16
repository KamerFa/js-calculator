import { useState } from 'react';
import { IconPlus } from './Icons';
import TaskRow from './TaskRow';

const STATUS_ORDER = ['todo', 'in-progress', 'done'];
const STATUS_LABELS = { todo: 'Todo', 'in-progress': 'In Progress', done: 'Done' };

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function isToday(dateStr) {
  if (!dateStr) return false;
  return String(dateStr).slice(0, 10) === getToday();
}

function isDueOrRecurringToday(task) {
  if (task.status === 'done') return false;
  if (isToday(task.dueDate)) return true;
  if (task.recurrence && task.recurrence !== 'none') return true;
  return false;
}

export default function TaskList({ tasks, projects, onToggle, onTaskClick, onEdit, onDelete, onProjectClick, onNewTask }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const filtered = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  const todayTasks = filtered.filter((t) => isDueOrRecurringToday(t));
  const laterTasks = filtered.filter((t) => !isDueOrRecurringToday(t));

  const makeGroups = (list) =>
    STATUS_ORDER.map((s) => ({
      status: s,
      label: STATUS_LABELS[s],
      tasks: list.filter((t) => t.status === s),
    })).filter((g) => g.tasks.length > 0);

  const todayGroups = makeGroups(todayTasks);
  const laterGroups = makeGroups(laterTasks);

  const getProject = (id) => projects.find((p) => p.id === id);
  const openCount = tasks.filter((t) => t.status !== 'done').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  const renderGroup = (group) => (
    <div className="task-group" key={group.status}>
      <div className="task-group-header">
        <span>{group.label}</span>
        <span className="task-group-count">{group.tasks.length}</span>
      </div>
      {group.tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          project={getProject(task.projectId)}
          showProject={true}
          onToggle={onToggle}
          onClick={onTaskClick}
          onEdit={onEdit}
          onDelete={onDelete}
          onProjectClick={onProjectClick}
        />
      ))}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>All Tasks</h1>
            <p className="subtitle">{openCount} open, {doneCount} completed</p>
          </div>
          <button className="btn btn-primary" onClick={() => onNewTask()}>
            <IconPlus /> New Task
          </button>
        </div>
      </div>

      <div className="filter-bar">
        {['all', 'todo', 'in-progress', 'done'].map((s) => (
          <button key={s} className={`chip${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'All' : STATUS_LABELS[s] || s}
          </button>
        ))}
        <div className="divider" />
        {['all', 'high', 'medium', 'low'].map((p) => (
          <button key={p} className={`chip${priorityFilter === p ? ' active' : ''}`} onClick={() => setPriorityFilter(p)}>
            {p === 'all' ? 'Any Priority' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {todayGroups.length > 0 && (
        <div className="task-section">
          <div className="task-section-header">
            <span className="task-section-dot today" />
            Danas
            <span className="task-group-count">{todayTasks.length}</span>
          </div>
          {todayGroups.map(renderGroup)}
        </div>
      )}

      {laterGroups.length > 0 && (
        <div className="task-section">
          <div className="task-section-header">
            <span className="task-section-dot later" />
            Poslije
            <span className="task-group-count">{laterTasks.length}</span>
          </div>
          {laterGroups.map(renderGroup)}
        </div>
      )}

      {filtered.length === 0 && <div className="empty-state">No tasks match your filters.</div>}
    </div>
  );
}
