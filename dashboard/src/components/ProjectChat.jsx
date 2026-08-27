import { useState, useEffect, useRef } from 'react';
import { DB } from '../db';
import { resolveAvatarUrl } from '../avatarUtils';
import { IconReply } from './Icons';
import ReactionPicker from './ReactionPicker';
import { timeAgo } from '../utils/time';

function renderBody(body, onUserClick) {
  const parts = body.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const username = part.slice(1);
      const isGroupMention = username === 'chat';
      return (
        <span
          key={i}
          className={`chat-mention${isGroupMention ? ' group' : ''}`}
          onClick={() => !isGroupMention && onUserClick?.(username)}
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
  const [replyTo, setReplyTo] = useState(null);
  const [showReactPickerForMsg, setShowReactPickerForMsg] = useState(null);
  const [reactorsPopup, setReactorsPopup] = useState(null);
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

  // Close react picker on outside click
  useEffect(() => {
    if (!showReactPickerForMsg) return;
    const handleClick = (e) => {
      if (!e.target.closest('.msg-react-picker') && !e.target.closest('.chat-react-btn')) {
        setShowReactPickerForMsg(null);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showReactPickerForMsg]);

  const handleSend = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await DB.postProjectMessage(projectId, body.trim(), replyTo?.id);
      setBody('');
      setReplyTo(null);
      await loadMessages();
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId) => {
    await DB.deleteProjectMessage(projectId, messageId);
    await loadMessages();
  };

  const handleReact = async (msgId, emoji) => {
    try {
      await DB.reactToProjectMessage(projectId, msgId, emoji);
      setShowReactPickerForMsg(null);
      await loadMessages();
    } catch { /* ignore */ }
  };

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`pchat-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('msg-highlight');
      setTimeout(() => el.classList.remove('msg-highlight'), 2000);
    }
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

  const filteredMembers = (() => {
    const list = (members || []).filter(
      (m) => m.username.toLowerCase().includes(mentionFilter) && m.userId !== user?.id
    );
    if ('chat'.includes(mentionFilter)) {
      return [{ userId: '__chat__', username: 'chat', isGroupMention: true }, ...list];
    }
    return list;
  })();

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
        {messages.map((msg) => {
          const isMine = msg.userId === user?.id;
          return (
            <div key={msg.id} id={`pchat-${msg.id}`} className={`chat-message${isMine ? ' mine' : ''}`}>
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
                  <button
                    className="chat-reply-btn"
                    onClick={() => { setReplyTo({ id: msg.id, body: msg.body, username: msg.username }); inputRef.current?.focus(); }}
                    title="Reply"
                  >
                    <IconReply size={11} />
                  </button>
                  <button
                    className="chat-react-btn"
                    onClick={(e) => { e.stopPropagation(); setShowReactPickerForMsg(showReactPickerForMsg === msg.id ? null : msg.id); }}
                    title="React"
                  >+</button>
                  {isMine && (
                    <button className="chat-msg-delete" onClick={() => handleDelete(msg.id)}>&times;</button>
                  )}
                </div>
                {msg.replyTo && (
                  <div className="msg-reply-preview" onClick={() => scrollToMessage(msg.replyTo.id)} style={{ marginBottom: 4 }}>
                    <span className="msg-reply-author">{msg.replyTo.username}</span>
                    <span className="msg-reply-text">{msg.replyTo.body}</span>
                  </div>
                )}
                <p className="chat-msg-body">{renderBody(msg.body, onUserClick)}</p>
                {showReactPickerForMsg === msg.id && (
                  <ReactionPicker onSelect={(e) => handleReact(msg.id, e)} className="msg-react-picker" />
                )}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="msg-reactions">
                    {Object.entries(msg.reactions).map(([emoji, users]) => {
                      const isMineReaction = users.some(u => u.userId === user?.id);
                      return (
                        <div key={emoji} className="reaction-chip-wrapper" style={{ position: 'relative' }}>
                          <button
                            className={`reaction-chip${isMineReaction ? ' mine' : ''}`}
                            onClick={() => handleReact(msg.id, emoji)}
                            onMouseEnter={() => setReactorsPopup({ msgId: msg.id, emoji, users })}
                            onMouseLeave={() => setReactorsPopup(null)}
                          >
                            {emoji} {users.length}
                          </button>
                          {reactorsPopup?.msgId === msg.id && reactorsPopup?.emoji === emoji && (
                            <div className="reactors-popup">
                              <div className="reactors-popup-title">{emoji} Reacted by</div>
                              {users.map(u => (
                                <div key={u.userId} className="reactors-popup-user"
                                  onClick={() => onUserClick && onUserClick(u.username)}>
                                  @{u.username}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="project-chat-compose">
        {replyTo && (
          <div className="compose-reply-banner">
            <span>Replying to <strong>{replyTo.username}</strong>: {replyTo.body.slice(0, 40)}{replyTo.body.length > 40 ? '...' : ''}</span>
            <button className="compose-reply-cancel" onClick={() => setReplyTo(null)}>&times;</button>
          </div>
        )}
        {showMentions && filteredMembers.length > 0 && (
          <div className="mention-dropdown">
            {filteredMembers.slice(0, 8).map((m) => (
              <button key={m.userId} className="mention-option" onClick={() => insertMention(m.username)}>
                {m.isGroupMention ? (
                  <span className="mention-option-avatar mention-option-group">@</span>
                ) : resolveAvatarUrl(m.avatarUrl) ? (
                  <img src={resolveAvatarUrl(m.avatarUrl)} alt="" className="mention-option-avatar" />
                ) : (
                  <span className="mention-option-avatar mention-option-placeholder">
                    {m.username.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="mention-option-name">
                  @{m.username}
                  {m.isGroupMention && <span className="mention-option-hint"> — notify everyone</span>}
                </span>
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
