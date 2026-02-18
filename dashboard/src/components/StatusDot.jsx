// Slack-style presence dot + custom status
// Usage: <StatusDot presence="active" size={10} />
//        <StatusDot presence="away" customStatus={{ emoji: '🏖️', text: 'Vacation' }} />

const PRESENCE = {
  active:  { color: '#44b700', label: 'Active' },
  away:    { color: '#f5a623', label: 'Away' },
  dnd:     { color: '#e74c3c', label: 'Do Not Disturb' },
  offline: { color: '#95a5a6', label: 'Offline' },
};

export function getPresenceInfo(presence) {
  return PRESENCE[presence] || PRESENCE.offline;
}

export default function StatusDot({ presence = 'offline', size = 10, style, statusEmoji, statusText }) {
  const info = getPresenceInfo(presence);
  const isDnd = presence === 'dnd';

  // Build a rich tooltip: "Active" or "Away · 🏖️ On vacation"
  let tooltip = info.label;
  if (statusEmoji || statusText) {
    const parts = [statusEmoji, statusText].filter(Boolean).join(' ');
    tooltip += ` · ${parts}`;
  }

  return (
    <span
      className={`status-dot status-dot-${presence}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: info.color,
        display: 'inline-block',
        flexShrink: 0,
        position: 'relative',
        cursor: 'default',
        ...style,
      }}
      title={tooltip}
    >
      {isDnd && (
        <span
          style={{
            position: 'absolute',
            top: '50%',
            left: '15%',
            right: '15%',
            height: 1.5,
            background: '#fff',
            transform: 'translateY(-50%)',
            borderRadius: 1,
          }}
        />
      )}
    </span>
  );
}

export function CustomStatusBadge({ emoji, text, onClick }) {
  if (!emoji && !text) return null;
  return (
    <button className="custom-status-badge" onClick={onClick} title={text || ''}>
      {emoji && <span className="custom-status-emoji">{emoji}</span>}
      {text && <span className="custom-status-text">{text}</span>}
    </button>
  );
}
