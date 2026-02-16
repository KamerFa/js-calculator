import { useState, useEffect } from 'react';
import { DB } from '../db';
import { IconX, IconUserPlus, IconTrash } from './Icons';

export default function ShareModal({ open, project, user, onClose, onChanged }) {
  const [members, setMembers] = useState([]);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && project) {
      DB.getProjectMembers(project.id).then(setMembers).catch(() => {});
      setUsername('');
      setError('');
    }
  }, [open, project]);

  if (!open || !project) return null;

  const isOwner = project.isOwner;

  const handleInvite = async () => {
    if (!username.trim()) return;
    setError('');
    setLoading(true);
    try {
      await DB.addProjectMember(project.id, username.trim());
      const updated = await DB.getProjectMembers(project.id);
      setMembers(updated);
      setUsername('');
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId) => {
    try {
      await DB.removeProjectMember(project.id, userId);
      const updated = await DB.getProjectMembers(project.id);
      setMembers(updated);
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleInvite();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Share Project</h2>
          <button className="modal-close" onClick={onClose}><IconX /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
            Invite people to <strong>{project.name}</strong>. Members can add tasks and track progress together.
          </p>

          {isOwner && (
            <div className="share-invite-row">
              <input
                className="form-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter username to invite..."
                disabled={loading}
              />
              <button className="btn btn-primary btn-sm" onClick={handleInvite} disabled={loading}>
                <IconUserPlus /> Invite
              </button>
            </div>
          )}

          {error && <div className="share-error">{error}</div>}

          <div className="share-members-label">Members ({members.length})</div>
          <div className="share-members-list">
            {members.map((m) => {
              const progress = m.tasks.total > 0 ? Math.round((m.tasks.done / m.tasks.total) * 100) : 0;
              return (
                <div className="share-member-row" key={m.userId}>
                  <div className="share-member-avatar">
                    {m.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="share-member-info">
                    <div className="share-member-name">
                      {m.username}
                      {m.role === 'owner' && <span className="share-role-tag">Owner</span>}
                      {m.userId === user?.id && m.role !== 'owner' && <span className="share-role-tag you">You</span>}
                    </div>
                    <div className="share-member-stats">
                      {m.tasks.total > 0 ? (
                        <>
                          <div className="share-progress-bar">
                            <div className="share-progress-fill" style={{ width: progress + '%' }} />
                          </div>
                          <span>{m.tasks.done}/{m.tasks.total} done</span>
                        </>
                      ) : (
                        <span>No tasks yet</span>
                      )}
                    </div>
                  </div>
                  {isOwner && m.role !== 'owner' && (
                    <button className="icon-btn danger" title="Remove member" onClick={() => handleRemove(m.userId)}>
                      <IconTrash />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
