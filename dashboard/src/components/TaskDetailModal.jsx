import { IconX } from './Icons';

export default function TaskDetailModal({ open, task, projects, notes, onClose, onEdit, onProjectClick, onNoteClick }) {
  if (!open || !task) return null;

  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const isOverdue = task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date(new Date().toISOString().split('T')[0]);

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Notes attached to this task
  const taskNotes = (notes || []).filter(
    (n) => n.attachedTo?.type === 'task' && n.attachedTo?.id === task.id
  );

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
          {task.screenshotUrl && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Screenshot:</span>
              <img
                src={task.screenshotUrl}
                alt="Screenshot"
                className="screenshot-detail-img"
                onClick={() => window.open(task.screenshotUrl, '_blank')}
              />
            </div>
          )}
          {task.completedBy && task.status === 'done' && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Completed by: </span>
              <span className="completed-by-tag" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10 }}>{task.completedBy}</span>
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

          {/* Notes attached to this task */}
          {taskNotes.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 8 }}>Notes ({taskNotes.length}):</span>
              <div className="project-notes-list" style={{ gridTemplateColumns: '1fr' }}>
                {taskNotes.map((note) => (
                  <div
                    className="project-note-card"
                    key={note.id}
                    onClick={() => onNoteClick && onNoteClick(note)}
                  >
                    <div className="project-note-title">{note.title || 'Untitled'}</div>
                    <div className="project-note-body">{note.body}</div>
                  </div>
                ))}
              </div>
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
