import { IconX } from './Icons';

export default function TaskDetailModal({ open, task, projects, onClose, onEdit, onProjectClick }) {
  if (!open || !task) return null;

  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const isOverdue = task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date(new Date().toISOString().split('T')[0]);

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Task Details</h2>
          <button className="modal-close" onClick={onClose}><IconX /></button>
        </div>
        <div className="modal-body">
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 18, marginBottom: 12 }}>{task.title}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>{task.description || 'No description'}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <span className={`priority-badge ${task.priority}`}>{task.priority}</span>
            <span className="chip active" style={{ cursor: 'default' }}>{task.status}</span>
            {task.dueDate && (
              <span className={`task-due${isOverdue ? ' overdue' : ''}`}>Due: {formatDate(task.dueDate)}</span>
            )}
          </div>
          {project && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Project: </span>
              <span
                className="project-tag"
                style={{ background: project.color + '18', color: project.color, cursor: 'pointer' }}
                onClick={() => { onProjectClick(project.id); onClose(); }}
              >
                <span className="project-dot" style={{ width: 7, height: 7, background: project.color }} />
                {project.name}
              </span>
            </div>
          )}
          {task.customFields?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Custom Fields:</span>
              {task.customFields.map((cf, i) => (
                <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong style={{ fontWeight: 500 }}>{cf.key}:</strong>{' '}
                  <span style={{ color: 'var(--text-2)' }}>{cf.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => { onClose(); onEdit(task); }}>Edit</button>
        </div>
      </div>
    </div>
  );
}
