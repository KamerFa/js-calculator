import { useState, useEffect, useRef } from 'react';
import { DB } from '../db';
import { resolveAvatarUrl } from '../avatarUtils';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function renderBody(body, onUserClick) {
  // Split body by @mentions and render them as clickable links
  const parts = body.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <span
          key={i}
          className="chat-mention"
          onClick={() => onUserClick && onUserClick(username)}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

export default function ProjectChat({ projectId, members, user, onUserClick }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);

  const loadMessages = async () => {
    try {
      const data = await DB.getProjectMessages(projectId);
      setMessages(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (open) {
      loadMessages();
      const interval = setInterval(loadMessages, 15000);
      return () => clearInterval(interval);
    }
  }, [projectId, open]);

  useEffect(() => {
    if (messagesEndRef.current && open) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const handleSend = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await DB.postProjectMessage(projectId, body.trim());
      setBody('');
      await loadMessages();
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId) => {
    await DB.deleteProjectMessage(projectId, messageId);
    await loadMessages();
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setBody(val);

    // Check if user is typing @mention
    const cursor = e.target.selectionStart;
    const textUpToCursor = val.slice(0, cursor);
    const mentionMatch = textUpToCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      setShowMentions(true);
      setMentionFilter(mentionMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (username) => {
    const cursor = inputRef.current?.selectionStart || body.length;
    const textUpToCursor = body.slice(0, cursor);
    const mentionMatch = textUpToCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const before = textUpToCursor.slice(0, mentionMatch.index);
      const after = body.slice(cursor);
      setBody(`${before}@${username} ${after}`);
    }
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const filteredMembers = (members || []).filter(
    (m) => m.username.toLowerCase().includes(mentionFilter) && m.userId !== user?.id
  );

  if (!open) {
    return (
      <div className="project-chat-toggle">
        <button className="btn btn-sm" onClick={() => setOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Project Board
          {messages.length > 0 && <span className="chat-count">{messages.length}</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="project-chat">
      <div className="project-chat-header">
        <h3>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Project Board
        </h3>
        <button className="btn btn-sm" onClick={() => setOpen(false)}>Hide</button>
      </div>

      <div className="project-chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">No messages yet. Start the conversation!</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message${msg.userId === user?.id ? ' mine' : ''}`}>
            <div className="chat-msg-avatar" onClick={() => onUserClick && onUserClick(msg.username)} style={{ cursor: 'pointer' }}>
              {resolveAvatarUrl(msg.avatarUrl)
                ? <img src={resolveAvatarUrl(msg.avatarUrl)} alt="" className="chat-msg-avatar-img" />
                : msg.username.charAt(0).toUpperCase()
              }
            </div>
            <div className="chat-msg-content">
              <div className="chat-msg-header">
                <span className="chat-msg-username" onClick={() => onUserClick && onUserClick(msg.username)}>
                  @{msg.username}
                </span>
                <span className="chat-msg-time">{timeAgo(msg.createdAt)}</span>
                {msg.userId === user?.id && (
                  <button className="chat-msg-delete" onClick={() => handleDelete(msg.id)}>&times;</button>
                )}
              </div>
              <p className="chat-msg-body">{renderBody(msg.body, onUserClick)}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="project-chat-compose">
        {showMentions && filteredMembers.length > 0 && (
          <div className="mention-dropdown">
            {filteredMembers.slice(0, 8).map((m) => (
              <button key={m.userId} className="mention-option" onClick={() => insertMention(m.username)}>
                @{m.username}
              </button>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          className="form-input chat-input"
          type="text"
          placeholder="Type a message... Use @username to tag"
          value={body}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          maxLength={1000}
        />
        <button className="btn btn-primary btn-sm" disabled={!body.trim() || sending} onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}
