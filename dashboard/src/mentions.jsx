import { useState } from 'react';

// Render text with clickable @mentions
export function renderWithMentions(text, onUserClick) {
  if (!text) return text;
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <span
          key={i}
          className="tweet-mention"
          onClick={(e) => { e.stopPropagation(); onUserClick?.(username); }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

// Mention dropdown hook for any text input
export function useMentions(allUsers, currentUser) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');

  const filteredUsers = (allUsers || []).filter(
    (u) => u.username.toLowerCase().includes(mentionFilter) && u.username !== currentUser?.username
  ).slice(0, 8);

  const detectMention = (value, cursorPos) => {
    const textUpToCursor = value.slice(0, cursorPos);
    const match = textUpToCursor.match(/@(\w*)$/);
    if (match) {
      setShowMentions(true);
      setMentionFilter(match[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (username, currentValue, cursorPos) => {
    const textUpToCursor = currentValue.slice(0, cursorPos);
    const match = textUpToCursor.match(/@(\w*)$/);
    if (match) {
      const before = textUpToCursor.slice(0, match.index);
      const after = currentValue.slice(cursorPos);
      setShowMentions(false);
      return `${before}@${username} ${after}`;
    }
    setShowMentions(false);
    return currentValue;
  };

  return { showMentions, filteredUsers, detectMention, insertMention, setShowMentions };
}

// Mention dropdown component for reuse in any textarea
export function MentionDropdown({ mentions, onSelect }) {
  if (!mentions.showMentions || mentions.filteredUsers.length === 0) return null;
  return (
    <div className="mention-dropdown">
      {mentions.filteredUsers.map((u) => (
        <button key={u.id} className="mention-option" onClick={() => onSelect(u.username)}>
          {u.avatarUrl ? (
            <img src={u.avatarUrl} alt="" className="mention-option-avatar" />
          ) : (
            <span className="mention-option-avatar mention-option-placeholder">{u.username.charAt(0).toUpperCase()}</span>
          )}
          <span>@{u.username}</span>
        </button>
      ))}
    </div>
  );
}
