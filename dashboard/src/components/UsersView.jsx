import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { resolveAvatarUrl } from '../avatarUtils';
import StatusDot from './StatusDot';

export default function UsersView({ onUserClick }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/users', {
      headers: { Authorization: `Bearer ${localStorage.getItem('dash_token')}` }
    })
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
  };

  if (loading) {
    return <div className="page-container"><div className="empty-state">{t('common.loading')}</div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{t('community.users')}</h1>
      </div>

      <div className="search-bar">
        <input
          type="text"
          className="form-input"
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="users-grid">
        {filteredUsers.map((user) => (
          <div key={user.id} className="user-card" onClick={() => onUserClick(user.username)}>
            <div className="user-card-avatar">
              <span className="avatar-with-status avatar-with-status-lg">
                {resolveAvatarUrl(user.avatarUrl) ? (
                  <img src={resolveAvatarUrl(user.avatarUrl)} alt={user.username} />
                ) : (
                  <div className="avatar-placeholder">{user.username.charAt(0).toUpperCase()}</div>
                )}
                <StatusDot presence={user.presence || 'offline'} size={14} statusEmoji={user.statusEmoji} statusText={user.statusText} style={{ position: 'absolute', bottom: 0, right: 0, border: '2.5px solid var(--surface)', borderRadius: '50%', boxSizing: 'content-box' }} />
              </span>
            </div>
            <div className="user-card-info">
              <h3>
                {user.username}
                {user.statusEmoji && <span className="user-card-status-emoji">{user.statusEmoji}</span>}
              </h3>
              <div className="user-card-stats">
                <span>{t('profile.tasksCompleted')}: <strong>{user.tasksCompleted}</strong></span>
                <span>{t('profile.projectsOwned')}: <strong>{user.projectsOwned}</strong></span>
              </div>
              <div className="user-card-meta">
                {t('profile.memberSince')} {formatDate(user.memberSince)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="empty-state">
          {search ? `${t('common.search')} "${search}" - ${t('common.noResults')}` : t('community.noUsers')}
        </div>
      )}
    </div>
  );
}
