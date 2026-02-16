import { useState, useEffect } from 'react';
import { DB } from '../db';
import { IconUsers, IconPlus } from './Icons';
import { resolveAvatarUrl } from '../avatarUtils';

const REACTION_EMOJIS = ['\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE4F', '\uD83D\uDD25', '\uD83D\uDC4D', '\uD83D\uDE22'];

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

function TweetCard({ tw, user, onDelete, onReact, onComment, onDeleteComment, onUserClick }) {
  const [showComments, setShowComments] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [showReactPicker, setShowReactPicker] = useState(false);

  const handleComment = async () => {
    if (!commentBody.trim()) return;
    await onComment(tw.id, commentBody.trim());
    setCommentBody('');
  };

  const reactionEntries = Object.entries(tw.reactions || {});

  return (
    <div className="tweet-card">
      <div className="tweet-avatar" onClick={() => onUserClick(tw.username)} style={{ cursor: 'pointer' }}>
        {resolveAvatarUrl(tw.avatarUrl)
          ? <img src={resolveAvatarUrl(tw.avatarUrl)} alt="" className="tweet-avatar-img" />
          : tw.username.charAt(0).toUpperCase()
        }
      </div>
      <div className="tweet-content">
        <div className="tweet-header">
          <span className="tweet-username" onClick={() => onUserClick(tw.username)} style={{ cursor: 'pointer' }}>
            @{tw.username}
          </span>
          <span className="tweet-time">{timeAgo(tw.createdAt)}</span>
          {tw.userId === user?.id && (
            <button className="tweet-delete" onClick={() => onDelete(tw.id)}>&times;</button>
          )}
        </div>
        <p className="tweet-body">{tw.body}</p>

        {/* Reactions display */}
        <div className="tweet-reactions">
          {reactionEntries.map(([emoji, users]) => {
            const isMine = users.some((u) => u.userId === user?.id);
            return (
              <button
                key={emoji}
                className={`reaction-chip${isMine ? ' mine' : ''}`}
                onClick={() => onReact(tw.id, emoji)}
                title={users.map((u) => u.username).join(', ')}
              >
                {emoji} {users.length}
              </button>
            );
          })}

          <div className="react-picker-wrapper">
            <button
              className="reaction-add-btn"
              onClick={() => setShowReactPicker(!showReactPicker)}
            >+</button>
            {showReactPicker && (
              <div className="react-picker">
                {REACTION_EMOJIS.map((e) => (
                  <button
                    key={e}
                    className="react-picker-emoji"
                    onClick={() => { onReact(tw.id, e); setShowReactPicker(false); }}
                  >{e}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Comments toggle */}
        <div className="tweet-actions-bar">
          <button className="tweet-comment-toggle" onClick={() => setShowComments(!showComments)}>
            {(tw.comments?.length || 0) > 0
              ? `${tw.comments.length} comment${tw.comments.length === 1 ? '' : 's'}`
              : 'Comment'}
          </button>
        </div>

        {showComments && (
          <div className="tweet-comments">
            {tw.comments?.map((c) => (
              <div className="comment-row" key={c.id}>
                <div className="comment-avatar" onClick={() => onUserClick(c.username)} style={{ cursor: 'pointer' }}>
                  {resolveAvatarUrl(c.avatarUrl)
                    ? <img src={resolveAvatarUrl(c.avatarUrl)} alt="" className="comment-avatar-img" />
                    : c.username.charAt(0).toUpperCase()
                  }
                </div>
                <div className="comment-body">
                  <span className="comment-username" onClick={() => onUserClick(c.username)} style={{ cursor: 'pointer' }}>
                    @{c.username}
                  </span>
                  <span className="comment-time">{timeAgo(c.createdAt)}</span>
                  {c.userId === user?.id && (
                    <button className="tweet-delete" onClick={() => onDeleteComment(c.id)}>&times;</button>
                  )}
                  <p className="comment-text">{c.body}</p>
                </div>
              </div>
            ))}
            <div className="comment-compose">
              <input
                className="form-input comment-input"
                type="text"
                placeholder="Write a comment..."
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value.slice(0, 500))}
                onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              />
              <button className="btn btn-primary btn-sm" disabled={!commentBody.trim()} onClick={handleComment}>
                Reply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommunityView({ user, onProjectClick, onReload, onUserClick }) {
  const [tweets, setTweets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tweetBody, setTweetBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [tab, setTab] = useState('feed');
  const [dismissedBanner, setDismissedBanner] = useState(() =>
    localStorage.getItem('ramadan_banner_dismissed') === '1'
  );

  const loadData = async () => {
    const [tw, cp] = await Promise.all([DB.getTweets(), DB.getCommunityProjects()]);
    setTweets(tw);
    setProjects(cp);
  };

  useEffect(() => { loadData(); }, []);

  const handlePost = async () => {
    if (!tweetBody.trim() || posting) return;
    setPosting(true);
    try {
      await DB.postTweet(tweetBody.trim());
      setTweetBody('');
      await loadData();
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteTweet = async (id) => {
    await DB.deleteTweet(id);
    await loadData();
  };

  const handleReact = async (tweetId, emoji) => {
    await DB.reactToTweet(tweetId, emoji);
    await loadData();
  };

  const handleComment = async (tweetId, body) => {
    await DB.commentOnTweet(tweetId, body);
    await loadData();
  };

  const handleDeleteComment = async (commentId) => {
    await DB.deleteComment(commentId);
    await loadData();
  };

  const handleJoin = async (projectId) => {
    await DB.joinCommunityProject(projectId);
    await loadData();
    if (onReload) onReload();
  };

  const handleLeave = async (projectId) => {
    await DB.leaveCommunityProject(projectId);
    await loadData();
    if (onReload) onReload();
  };

  const ramadanProject = projects.find((p) => p.isGlobal);

  const dismissBanner = () => {
    setDismissedBanner(true);
    localStorage.setItem('ramadan_banner_dismissed', '1');
  };

  return (
    <div>
      {/* Ramadan Banner */}
      {ramadanProject && !dismissedBanner && (
        <div className="ramadan-banner">
          <button className="ramadan-banner-close" onClick={dismissBanner}>&times;</button>
          <div className="ramadan-banner-icon">&#9770;</div>
          <div className="ramadan-banner-content">
            <h3>Ramadan Mubarak! Join {ramadanProject.memberCount} others tracking their ibadah</h3>
            <p className="ramadan-quote">
              "To seek trouble - this is not courage, this is madness. Courage is the willingness of man to sensibly face the troubles he cannot avoid."
              <span className="ramadan-quote-author"> - Alija Izetbegovic</span>
            </p>
            <p className="ramadan-subtitle">
              ...and skipping Suhoor is definitely seeking trouble. Don't be that person.
            </p>
            {!ramadanProject.isMember ? (
              <button className="btn btn-primary btn-sm" onClick={() => handleJoin(ramadanProject.id)}>
                Join Ramadan
              </button>
            ) : (
              <span className="ramadan-joined-tag">You're in! MashAllah</span>
            )}
          </div>
        </div>
      )}

      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Community</h1>
            <p className="subtitle">See what everyone is up to</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="filter-bar">
        <button className={`chip${tab === 'feed' ? ' active' : ''}`} onClick={() => setTab('feed')}>
          Feed
        </button>
        <button className={`chip${tab === 'projects' ? ' active' : ''}`} onClick={() => setTab('projects')}>
          Public Projects
        </button>
      </div>

      {tab === 'feed' && (
        <div>
          {/* Compose tweet */}
          <div className="tweet-compose">
            <div className="tweet-compose-avatar">
              {resolveAvatarUrl(user?.avatarUrl)
                ? <img src={resolveAvatarUrl(user?.avatarUrl)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : user?.username?.charAt(0).toUpperCase()
              }
            </div>
            <div className="tweet-compose-body">
              <textarea
                className="form-textarea tweet-textarea"
                placeholder="What's on your mind? (280 chars max)"
                value={tweetBody}
                onChange={(e) => setTweetBody(e.target.value.slice(0, 280))}
                rows={2}
              />
              <div className="tweet-compose-footer">
                <span className="tweet-char-count">{tweetBody.length}/280</span>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!tweetBody.trim() || posting}
                  onClick={handlePost}
                >
                  Tweet
                </button>
              </div>
            </div>
          </div>

          {/* Tweet Feed */}
          <div className="tweet-feed">
            {tweets.length === 0 && (
              <div className="empty-state">No tweets yet. Be the first to post!</div>
            )}
            {tweets.map((tw) => (
              <TweetCard
                key={tw.id}
                tw={tw}
                user={user}
                onDelete={handleDeleteTweet}
                onReact={handleReact}
                onComment={handleComment}
                onDeleteComment={handleDeleteComment}
                onUserClick={onUserClick || (() => {})}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'projects' && (
        <div className="community-projects-grid">
          {projects.length === 0 && (
            <div className="empty-state">No public projects yet.</div>
          )}
          {projects.map((p) => (
            <div className="community-project-card" key={p.id}>
              <div className="community-project-header">
                <span className="project-dot" style={{ background: p.color }} />
                <span className="community-project-name">{p.name}</span>
                {p.isGlobal && <span className="community-global-tag">Global</span>}
              </div>
              <p className="community-project-desc">{p.description}</p>
              <div className="community-project-stats">
                <span><IconUsers /> {p.memberCount} members</span>
                <span>{p.doneCount}/{p.taskCount} tasks done</span>
              </div>
              <div className="community-project-footer">
                {p.isMember ? (
                  <>
                    <button className="btn btn-sm" onClick={() => onProjectClick(p.id)}>View Project</button>
                    {!p.isGlobal && (
                      <button className="btn btn-sm btn-danger" onClick={() => handleLeave(p.id)}>Leave</button>
                    )}
                  </>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => handleJoin(p.id)}>
                    <IconPlus size={12} /> Join
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
