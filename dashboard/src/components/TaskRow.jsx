import { IconCheckSmall, IconEdit, IconTrash } from './Icons';

const REC_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

export default function TaskRow({ task, project, showProject, showCreator, currentUserId, onToggle, onClick, onEdit, onDelete, onProjectClick }) {
  const isOverdue = task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date(new Date().toISOString().split('T')[0]);
  const isOwnTask = !currentUserId || task.userId === currentUserId;

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="task-row" onClick={() => onClick(task)}>
      <div
        className={`task-checkbox${task.status === 'done' ? ' checked' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggle(task); }}
      >
        <IconCheckSmall />
      </div>
      <span className={`task-title${task.status === 'done' ? ' done' : ''}`}>{task.title}</span>
      {task.screenshotUrl && (
        <span className="screenshot-thumb-badge" title="Has screenshot">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
          </svg>
        </span>
      )}
      {task.recurrence && task.recurrence !== 'none' && (
        <span className="recurrence-badge">{REC_LABELS[task.recurrence]}</span>
      )}
      {task.taskType === 'per_member' && (
        <span className="per-member-badge" title="Each member tracks this independently">Per member</span>
      )}
      {showCreator && task.status === 'done' && task.completedBy && (
        <span className="creator-tag completed-by-tag" title={`Completed by ${task.completedBy}`}>{task.completedBy}</span>
      )}
      {showCreator && task.status !== 'done' && task.createdBy && (
        <span className="creator-tag">{task.createdBy}</span>
      )}
      {showProject && project && (
        <span
          className="project-tag"
          style={{ background: project.color + '18', color: project.color }}
          onClick={(e) => { e.stopPropagation(); onProjectClick(project.id); }}
        >
          <span className="project-dot" style={{ width: 7, height: 7, background: project.color }} />
          {project.name}
        </span>
      )}
      <span className={`priority-badge ${task.priority}`}>{task.priority}</span>
      {task.dueDate && (
        <span className={`task-due${isOverdue ? ' overdue' : ''}`}>{formatDate(task.dueDate)}</span>
      )}
      <div className="task-actions">
        {isOwnTask && (
          <>
            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(task); }} title="Edit">
              <IconEdit />
            </button>
            <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(task); }} title="Delete">
              <IconTrash />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
