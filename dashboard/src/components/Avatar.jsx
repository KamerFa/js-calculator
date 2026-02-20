import { memo } from 'react';
import { resolveAvatarUrl } from '../avatarUtils';
import StatusDot from './StatusDot';

const Avatar = memo(function Avatar({ avatarUrl, username, size = 40, presence, statusEmoji, statusText, showStatus = false, onClick, className = '' }) {
  const url = resolveAvatarUrl(avatarUrl);
  const initial = username?.charAt(0)?.toUpperCase() || '?';

  return (
    <div
      className={`avatar-wrap ${className}`}
      style={{ width: size, height: size, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      {url
        ? <img src={url} alt={username} className="avatar-img" style={{ width: size, height: size }} />
        : <span className="avatar-placeholder" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>{initial}</span>
      }
      {showStatus && (
        <StatusDot
          presence={presence || 'offline'}
          size={size > 32 ? 10 : 8}
          statusEmoji={statusEmoji}
          statusText={statusText}
          style={{ position: 'absolute', bottom: -1, right: -1, border: '2px solid var(--surface)', borderRadius: '50%', boxSizing: 'content-box' }}
        />
      )}
    </div>
  );
});

export default Avatar;
