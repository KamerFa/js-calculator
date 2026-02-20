import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { IconX } from './Icons';
import { renderWithMentions } from '../mentions';
import ItemComments from './ItemComments';
import { DB } from '../db';
import { formatDate } from '../utils/time';

function CompletionHeatmap({ history }) {
  // Build a 52-day heatmap (7 rows x ~8 cols)
  const today = new Date();
  const days = [];
  for (let i = 51; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const completedDates = new Set(history.map((h) => h.completionDate));

  return (
    <div className="completion-heatmap">
      {days.map((day) => (
        <div
          key={day}
          className={`heatmap-cell${completedDates.has(day) ? ' completed' : ''}`}
          title={day}
        />
      ))}
    </div>
  );
}

export default function TaskDetailModal({ open, task, projects, notes, onClose, onEdit, onDelete, onProjectClick, onNoteClick }) {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [focusStats, setFocusStats] = useState(null);

  const isRecurring = task && task.recurrence && task.recurrence !== 'none';

  useEffect(() => {
    if (!open || !task || !isRecurring) {
      setHistory([]);
      return;
    }
    setLoadingHistory(true);
    DB.getTaskHistory(task.id)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [open, task?.id]);

  // Load focus stats for this task
  useEffect(() => {
    if (!open || !task) {
      setFocusStats(null);
      return;
    }
    DB.getFocusForTask(task.id)
      .then(setFocusStats)
      .catch(() => setFocusStats(null));
  }, [open, task?.id]);

  if (!open || !task) return null;

  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const effectiveDate = task.dueDate || task.scheduledDate;
  const isScheduled = !task.dueDate && !!task.scheduledDate;
  const isOverdue = task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date(new Date().toISOString().split('T')[0]);

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
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, whiteSpace: 'pre-wrap' }}>{task.description ? renderWithMentions(task.description, (u) => { onClose(); navigate(`/profile/${u}`); }) : 'No description'}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <span className={`priority-badge ${task.priority}`}>{task.priority}</span>
            <span className="chip active" style={{ cursor: 'default' }}>{task.status}</span>
            {effectiveDate && (
              <span className={`task-due${isOverdue ? ' overdue' : ''}${isScheduled ? ' scheduled' : ''}`}>
                {isScheduled ? 'Scheduled: ' : 'Due: '}{formatDate(effectiveDate)}
              </span>
            )}
          </div>

          {/* Completion Stats for recurring/repeatable tasks */}
          {isRecurring && (
            <div className="completion-stats-section">
              <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 8 }}>Completion Stats:</span>
              <div className="completion-stats-row">
                <div className="stat-box">
                  <div className="stat-value">{task.completionCount || 0}</div>
                  <div className="stat-label">Total</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{task.currentStreak || 0}</div>
                  <div className="stat-label">Current Streak</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{task.bestStreak || 0}</div>
                  <div className="stat-label">Best Streak</div>
                </div>
              </div>

              {!loadingHistory && history.length > 0 && (
                <>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginTop: 12, marginBottom: 6 }}>Last 52 days:</span>
                  <CompletionHeatmap history={history} />

                  <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginTop: 12, marginBottom: 6 }}>Recent completions:</span>
                  <div className="completion-history-list">
                    {history.slice(0, 10).map((h, i) => (
                      <div key={i} className="completion-history-item">
                        <span>{new Date(h.completionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{h.username}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Focus time stats */}
          {focusStats && focusStats.sessions > 0 && (
            <div className="focus-stats-section" style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 8 }}>Focus Time:</span>
              <div className="completion-stats-row">
                <div className="stat-box">
                  <div className="stat-value">{focusStats.sessions}</div>
                  <div className="stat-label">Sessions</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{Math.floor(focusStats.totalSeconds / 3600) > 0 ? `${Math.floor(focusStats.totalSeconds / 3600)}h ${Math.floor((focusStats.totalSeconds % 3600) / 60)}m` : `${Math.floor(focusStats.totalSeconds / 60)}m`}</div>
                  <div className="stat-label">Total Focused</div>
                </div>
              </div>
            </div>
          )}

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

          <ItemComments targetType="task" targetId={task.id} />
        </div>
        <div className="modal-footer">
          {onDelete && (
            <button className="btn btn-danger" onClick={() => { onClose(); onDelete(task); }}>Delete</button>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => { onClose(); onEdit(task); }}>Edit</button>
        </div>
      </div>
    </div>
  );
}
