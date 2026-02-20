import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { DB } from '../db';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { renderWithMentions, useMentions, MentionDropdown } from '../mentions';
import { timeAgoShort } from '../utils/time';

export default function ItemComments({ targetType, targetId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);
  const mentions = useMentions(allUsers, user);

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    DB.getComments(targetType, targetId)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [targetType, targetId]);

  useEffect(() => {
    if (allUsers.length === 0) {
      DB.getUsers().then(setAllUsers).catch(() => {});
    }
  }, []);

  const handlePost = async () => {
    if (!body.trim()) return;
    const comment = await DB.postComment(targetType, targetId, body.trim());
    setComments((prev) => [...prev, comment]);
    setBody('');
    mentions.setShowMentions(false);
  };

  const handleDelete = async (id) => {
    await DB.deleteItemComment(id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePost();
    }
  };

  const timeAgo = timeAgoShort;

  if (loading) return null;

  return (
    <div className="item-comments">
      <div className="item-comments-header">
        <span className="item-comments-title">Comments</span>
        <span className="item-comments-count">{comments.length}</span>
      </div>

      {comments.length > 0 && (
        <div className="item-comments-list">
          {comments.map((c) => (
            <div className="item-comment" key={c.id}>
              <div className="item-comment-avatar-col">
                <Avatar avatarUrl={c.avatarUrl} username={c.username} size={32} className="item-comment-avatar" />
              </div>
              <div className="item-comment-content">
                <div className="item-comment-meta">
                  <span
                    className="item-comment-author"
                    onClick={() => navigate(`/profile/${c.username}`)}
                  >
                    @{c.username}
                  </span>
                  <span className="item-comment-time">{timeAgo(c.createdAt)}</span>
                  {c.userId === user?.id && (
                    <button className="item-comment-del" onClick={() => handleDelete(c.id)}>&times;</button>
                  )}
                </div>
                <div className="item-comment-body">
                  {renderWithMentions(c.body, (u) => navigate(`/profile/${u}`))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="item-comment-compose" style={{ position: 'relative' }}>
        <textarea
          ref={inputRef}
          className="item-comment-input"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            mentions.detectMention(e.target.value, e.target.selectionStart);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment... (@ to mention)"
          rows={1}
        />
        <MentionDropdown mentions={mentions} onSelect={(username) => {
          const el = inputRef.current;
          const newVal = mentions.insertMention(username, body, el?.selectionStart || body.length);
          setBody(newVal);
        }} />
        <button className="item-comment-send" onClick={handlePost} disabled={!body.trim()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
