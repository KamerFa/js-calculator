import { useState, useRef, useEffect } from 'react';
import StatusDot, { getPresenceInfo } from './StatusDot';
import { DB } from '../db';

const PRESENCE_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'away', label: 'Away' },
  { value: 'dnd', label: 'Do Not Disturb' },
  { value: 'offline', label: 'Invisible' },
];

const QUICK_STATUSES = [
  { emoji: '\uD83D\uDCAC', text: 'In a meeting' },
  { emoji: '\uD83D\uDE8C', text: 'Commuting' },
  { emoji: '\uD83E\uDD12', text: 'Out sick' },
  { emoji: '\uD83C\uDFD6\uFE0F', text: 'On vacation' },
  { emoji: '\uD83C\uDFE0', text: 'Working remotely' },
  { emoji: '\uD83C\uDFB5', text: 'Listening to music' },
];

export default function StatusPicker({ currentPresence, currentStatus, onUpdate, onClose }) {
  const [presence, setPresence] = useState(currentPresence || 'active');
  const [emoji, setEmoji] = useState(currentStatus?.emoji || '');
  const [text, setText] = useState(currentStatus?.text || '');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const save = async (p, e, t) => {
    setSaving(true);
    try {
      await DB.updateStatus({
        presence: p,
        statusEmoji: e || null,
        statusText: t || null,
      });
      onUpdate({ presence: p, statusEmoji: e || null, statusText: t || null });
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handlePresenceChange = (val) => {
    setPresence(val);
    save(val, emoji, text);
  };

  const handleQuickStatus = (qs) => {
    setEmoji(qs.emoji);
    setText(qs.text);
    save(presence, qs.emoji, qs.text);
  };

  const handleClearStatus = () => {
    setEmoji('');
    setText('');
    save(presence, '', '');
  };

  const handleSetCustom = () => {
    save(presence, emoji, text);
  };

  return (
    <div className="status-picker" ref={ref}>
      <div className="status-picker-header">Set a status</div>

      {/* Custom status input */}
      <div className="status-picker-custom">
        <input
          ref={inputRef}
          className="status-picker-emoji-input"
          placeholder="\uD83D\uDE00"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
          maxLength={2}
        />
        <input
          className="status-picker-text-input"
          placeholder="What's your status?"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 80))}
          onKeyDown={(e) => e.key === 'Enter' && handleSetCustom()}
        />
        {(emoji || text) && (
          <button className="status-picker-clear" onClick={handleClearStatus} title="Clear">&times;</button>
        )}
      </div>
      {(emoji || text) && (
        <button className="status-picker-save-btn" onClick={handleSetCustom} disabled={saving}>
          {saving ? 'Saving...' : 'Save Status'}
        </button>
      )}

      {/* Quick statuses */}
      <div className="status-picker-quick-label">Quick status</div>
      <div className="status-picker-quick">
        {QUICK_STATUSES.map((qs) => (
          <button
            key={qs.text}
            className="status-picker-quick-item"
            onClick={() => handleQuickStatus(qs)}
          >
            <span>{qs.emoji}</span>
            <span>{qs.text}</span>
          </button>
        ))}
      </div>

      {/* Presence selector */}
      <div className="status-picker-divider" />
      <div className="status-picker-quick-label">Presence</div>
      <div className="status-picker-presence">
        {PRESENCE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`status-picker-presence-item${presence === opt.value ? ' status-picker-presence-active' : ''}`}
            onClick={() => handlePresenceChange(opt.value)}
          >
            <StatusDot presence={opt.value} size={10} />
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
