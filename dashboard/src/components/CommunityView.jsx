import { useState, useEffect, useRef } from 'react';
import { DB } from '../db';
import { IconUsers, IconPlus } from './Icons';
import { resolveAvatarUrl } from '../avatarUtils';
import { renderWithMentions, useMentions, MentionDropdown } from '../mentions';
import StatusDot from './StatusDot';
import { useTranslation } from '../i18n';

const REACTION_EMOJIS = [
  '\u2764\uFE0F', // red heart
  '\uD83D\uDE02', // laugh
  '\uD83D\uDE4F', // pray
  '\uD83D\uDD25', // fire
  '\uD83D\uDC4D', // thumbs up
  '\uD83D\uDE22', // sad
  '\uD83D\uDC4F', // clap
  '\uD83D\uDE0D', // heart eyes
  '\uD83E\uDD2F', // exploding head
  '\uD83D\uDE80', // rocket
  '\uD83C\uDF89', // party
  '\uD83E\uDD14', // thinking
  '\u2705', // checkmark
  '\uD83D\uDCAF', // hundred
  '\uD83D\uDC40', // eyes
  '\uD83E\uDD21', // clown
  '\uD83D\uDCA9', // poop
  '\u2615', // coffee
];

const TWEET_TEMPLATE_COUNT = 4;

const QUOTE_COUNT = 30;

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


function TweetCard({ tw, user, allUsers, onDelete, onEdit, onReact, onComment, onDeleteComment, onVoteComment, onUserClick }) {
  const [showComments, setShowComments] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [showReactPicker, setShowReactPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(tw.body);
  const [reactorsPopup, setReactorsPopup] = useState(null);
  const commentRef = useRef(null);
  const mentions = useMentions(allUsers, user);

  const handleComment = async () => {
    if (!commentBody.trim()) return;
    await onComment(tw.id, commentBody.trim());
    setCommentBody('');
    mentions.setShowMentions(false);
  };

  const handleCommentChange = (e) => {
    const val = e.target.value.slice(0, 500);
    setCommentBody(val);
    mentions.detectMention(val, e.target.selectionStart);
  };

  const handleCommentMentionSelect = (username) => {
    const cursor = commentRef.current?.selectionStart || commentBody.length;
    const newVal = mentions.insertMention(username, commentBody, cursor);
    setCommentBody(newVal.slice(0, 500));
    commentRef.current?.focus();
  };

  const handleEdit = async () => {
    if (!editBody.trim() || editBody === tw.body) {
      setIsEditing(false);
      return;
    }
    await onEdit(tw.id, editBody.trim());
    setIsEditing(false);
  };

  const reactionEntries = Object.entries(tw.reactions || {});

  return (
    <div className="tweet-card">
      <div className="tweet-avatar avatar-with-status" onClick={() => onUserClick(tw.username)} style={{ cursor: 'pointer' }}>
        {resolveAvatarUrl(tw.avatarUrl)
          ? <img src={resolveAvatarUrl(tw.avatarUrl)} alt="" className="tweet-avatar-img" />
          : tw.username.charAt(0).toUpperCase()
        }
        <StatusDot presence={tw.presence || 'offline'} size={10} statusEmoji={tw.statusEmoji} statusText={tw.statusText} style={{ position: 'absolute', bottom: -1, right: -1, border: '2px solid var(--surface)', borderRadius: '50%', boxSizing: 'content-box' }} />
      </div>
      <div className="tweet-content">
        <div className="tweet-header">
          <span className="tweet-username" onClick={() => onUserClick(tw.username)} style={{ cursor: 'pointer' }}>
            @{tw.username}
          </span>
          <span className="tweet-time">{timeAgo(tw.createdAt)}</span>
          {tw.userId === user?.id && (
            <>
              <button className="tweet-edit" onClick={() => setIsEditing(!isEditing)} title="Edit">&#9999;&#65039;</button>
              <button className="tweet-delete" onClick={() => onDelete(tw.id)}>&times;</button>
            </>
          )}
        </div>
        {isEditing ? (
          <div className="tweet-edit-form">
            <textarea
              className="form-textarea"
              value={editBody}
              onChange={(e) => setEditBody(e.target.value.slice(0, 280))}
              rows={2}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button className="btn btn-primary btn-sm" onClick={handleEdit}>Save</button>
              <button className="btn btn-sm" onClick={() => { setIsEditing(false); setEditBody(tw.body); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <p className="tweet-body">{renderWithMentions(tw.body, onUserClick)}</p>
        )}

        {/* Reactions display */}
        <div className="tweet-reactions">
          {reactionEntries.map(([emoji, users]) => {
            const isMine = users.some((u) => u.userId === user?.id);
            return (
              <div key={emoji} className="reaction-chip-wrapper">
                <button
                  className={`reaction-chip${isMine ? ' mine' : ''}`}
                  onClick={() => onReact(tw.id, emoji)}
                  onMouseEnter={() => setReactorsPopup({ emoji, users })}
                  onMouseLeave={() => setReactorsPopup(null)}
                >
                  {emoji} {users.length}
                </button>
                {reactorsPopup?.emoji === emoji && (
                  <div className="reactors-popup">
                    <div className="reactors-popup-title">{emoji} Reacted by</div>
                    {users.map((u) => (
                      <div key={u.userId} className="reactors-popup-user" onClick={() => onUserClick(u.username)}>
                        @{u.username}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
            {tw.comments?.map((c) => {
              const myVote = c.votes?.find((v) => v.userId === user?.id)?.vote || 0;
              return (
                <div className="comment-row" key={c.id}>
                  <div className="comment-vote-col">
                    <button
                      className={`vote-btn vote-up${myVote === 1 ? ' active' : ''}`}
                      onClick={() => onVoteComment(c.id, 1)}
                      title="Upvote"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>
                    </button>
                    <span className={`vote-score${(c.score || 0) > 0 ? ' positive' : (c.score || 0) < 0 ? ' negative' : ''}`}>
                      {c.score || 0}
                    </span>
                    <button
                      className={`vote-btn vote-down${myVote === -1 ? ' active' : ''}`}
                      onClick={() => onVoteComment(c.id, -1)}
                      title="Downvote"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20l8-8h-5V4H9v8H4z"/></svg>
                    </button>
                  </div>
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
                    <p className="comment-text">{renderWithMentions(c.body, onUserClick)}</p>
                  </div>
                </div>
              );
            })}
            <div className="comment-compose" style={{ position: 'relative' }}>
              <input
                ref={commentRef}
                className="form-input comment-input"
                type="text"
                placeholder="Write a comment... (type @ to mention)"
                value={commentBody}
                onChange={handleCommentChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !mentions.showMentions) handleComment();
                }}
              />
              <button className="btn btn-primary btn-sm" disabled={!commentBody.trim()} onClick={handleComment}>
                Reply
              </button>
              {mentions.showMentions && mentions.filteredUsers.length > 0 && (
                <div className="mention-dropdown" style={{ bottom: '100%', left: 0, right: 0 }}>
                  {mentions.filteredUsers.map((u) => (
                    <button key={u.id} className="mention-option" onClick={() => handleCommentMentionSelect(u.username)}>
                      <span className="mention-option-avatar">
                        {resolveAvatarUrl(u.avatarUrl)
                          ? <img src={resolveAvatarUrl(u.avatarUrl)} alt="" />
                          : u.username.charAt(0).toUpperCase()
                        }
                      </span>
                      @{u.username}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommunityView({ user, onProjectClick, onReload, onUserClick }) {
  const { t } = useTranslation();
  const quotes = Array.from({ length: QUOTE_COUNT }, (_, i) => ({
    text: t(`wisdom.quote_${i}`),
    author: t(`wisdom.author_${i}`),
  }));
  const tweetTemplates = Array.from({ length: TWEET_TEMPLATE_COUNT }, (_, i) => t(`community.tweetTemplate_${i}`));

  const [tweets, setTweets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tweetBody, setTweetBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [tab, setTab] = useState('feed');
  const [showTemplates, setShowTemplates] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [dismissedBanner, setDismissedBanner] = useState(() =>
    localStorage.getItem('ramadan_banner_dismissed') === '1'
  );
  const [dismissedQuotes, setDismissedQuotes] = useState(() =>
    localStorage.getItem('quotes_banner_dismissed') === '1'
  );
  const [quoteIndex, setQuoteIndex] = useState(() => {
    const day = Math.floor(Date.now() / 86400000);
    return day % QUOTE_COUNT;
  });

  const tweetRef = useRef(null);
  const mentions = useMentions(allUsers, user);

  const loadData = async () => {
    try {
      const [tw, cp] = await Promise.all([DB.getTweets(), DB.getCommunityProjects()]);
      setTweets(tw);
      setProjects(cp);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    DB.getUsers().then(setAllUsers).catch(() => {});
  }, []);

  const handleTweetChange = (e) => {
    const val = e.target.value.slice(0, 280);
    setTweetBody(val);
    mentions.detectMention(val, e.target.selectionStart);
  };

  const handleMentionSelect = (username) => {
    const cursor = tweetRef.current?.selectionStart || tweetBody.length;
    const newVal = mentions.insertMention(username, tweetBody, cursor);
    setTweetBody(newVal.slice(0, 280));
    tweetRef.current?.focus();
  };

  const handlePost = async () => {
    if (!tweetBody.trim() || posting) return;
    setPosting(true);
    mentions.setShowMentions(false);
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

  const handleEditTweet = async (id, body) => {
    await DB.editTweet(id, body);
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

  const handleVoteComment = async (commentId, vote) => {
    await DB.voteComment(commentId, vote);
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

  const ramadanProject = projects.find((p) => p.isGlobal && p.id !== 'global-dhikr-duas');
  const dhikrProject = projects.find((p) => p.id === 'global-dhikr-duas');

  const [dismissedDhikr, setDismissedDhikr] = useState(() =>
    localStorage.getItem('dhikr_banner_dismissed') === '1'
  );

  const dismissBanner = () => {
    setDismissedBanner(true);
    localStorage.setItem('ramadan_banner_dismissed', '1');
  };

  const dismissDhikrBanner = () => {
    setDismissedDhikr(true);
    localStorage.setItem('dhikr_banner_dismissed', '1');
  };

  const dismissQuotesBanner = () => {
    setDismissedQuotes(true);
    localStorage.setItem('quotes_banner_dismissed', '1');
  };

  const quote = quotes[quoteIndex];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>{t('community.title')}</h1>
            <p className="subtitle">{t('community.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Quotes Banner */}
      {!dismissedQuotes && (
        <div className="quotes-banner">
          <button className="quotes-banner-close" onClick={dismissQuotesBanner}>&times;</button>
          <div className="quotes-banner-label">{t('wisdom.label')}</div>
          <p className="quotes-banner-text">&ldquo;{quote.text}&rdquo;</p>
          <span className="quotes-banner-author">&mdash; {quote.author}</span>
          <div className="quotes-banner-nav">
            <button onClick={() => setQuoteIndex((i) => (i - 1 + quotes.length) % quotes.length)}>&larr; {t('wisdom.prev')}</button>
            <button onClick={() => setQuoteIndex((i) => (i + 1) % quotes.length)}>{t('wisdom.next')} &rarr;</button>
          </div>
        </div>
      )}

      {/* Ramadan Banner */}
      {ramadanProject && !dismissedBanner && (
        <div className="ramadan-banner">
          <button className="ramadan-banner-close" onClick={dismissBanner}>&times;</button>
          <div className="ramadan-banner-icon">&#9770;</div>
          <div className="ramadan-banner-content">
            <h3>{t('banners.ramadanTitle', { count: ramadanProject.memberCount })}</h3>
            <p className="ramadan-quote">
              "{t('banners.ramadanQuote')}"
              <span className="ramadan-quote-author"> - {t('banners.ramadanQuoteAuthor')}</span>
            </p>
            <p className="ramadan-subtitle">
              {t('banners.ramadanSubtitle')}
            </p>
            {!ramadanProject.isMember ? (
              <button className="btn btn-primary btn-sm" onClick={() => handleJoin(ramadanProject.id)}>
                {t('banners.joinRamadan')}
              </button>
            ) : (
              <span className="ramadan-joined-tag">{t('banners.ramadanJoined')}</span>
            )}
          </div>
        </div>
      )}

      {/* Dhikr & Duas Banner */}
      {dhikrProject && !dismissedDhikr && !dhikrProject.isMember && (
        <div className="ramadan-banner" style={{ borderLeft: '4px solid #1B5E20' }}>
          <button className="ramadan-banner-close" onClick={dismissDhikrBanner}>&times;</button>
          <div className="ramadan-banner-icon">&#128988;</div>
          <div className="ramadan-banner-content">
            <h3>{t('banners.dhikrTitle')}</h3>
            <p className="ramadan-subtitle">
              {t('banners.dhikrSubtitle', { count: dhikrProject.memberCount || '' })}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={() => handleJoin(dhikrProject.id)}>
                {t('banners.dhikrJoin')}
              </button>
              <button className="btn btn-sm" style={{ background: '#1B5E20', color: '#fff' }} onClick={() => { handleJoin(dhikrProject.id); localStorage.setItem('dhikr_toast_enabled', '1'); dismissDhikrBanner(); }}>
                {t('banners.dhikrJoinReminders')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="filter-bar">
        <button className={`chip${tab === 'feed' ? ' active' : ''}`} onClick={() => setTab('feed')}>
          {t('community.feed')}
        </button>
        <button className={`chip${tab === 'projects' ? ' active' : ''}`} onClick={() => setTab('projects')}>
          {t('community.projects')}
        </button>
      </div>

      {loading && (
        <div className="loading-spinner-wrapper">
          <div className="loading-spinner" />
          <span>{t('common.loading')}</span>
        </div>
      )}

      {!loading && tab === 'feed' && (
        <div>
          {/* Compose tweet */}
          <div className="tweet-compose">
            <div className="tweet-compose-avatar">
              {resolveAvatarUrl(user?.avatarUrl)
                ? <img src={resolveAvatarUrl(user?.avatarUrl)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : user?.username?.charAt(0).toUpperCase()
              }
            </div>
            <div className="tweet-compose-body" style={{ position: 'relative' }}>
              <textarea
                ref={tweetRef}
                className="form-textarea tweet-textarea"
                placeholder="What's on your mind? Type @ to tag someone (280 chars max)"
                value={tweetBody}
                onChange={handleTweetChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey && !mentions.showMentions) handlePost();
                }}
                rows={2}
              />
              {mentions.showMentions && mentions.filteredUsers.length > 0 && (
                <div className="mention-dropdown">
                  {mentions.filteredUsers.map((u) => (
                    <button key={u.id} className="mention-option" onClick={() => handleMentionSelect(u.username)}>
                      <span className="mention-option-avatar">
                        {resolveAvatarUrl(u.avatarUrl)
                          ? <img src={resolveAvatarUrl(u.avatarUrl)} alt="" />
                          : u.username.charAt(0).toUpperCase()
                        }
                      </span>
                      @{u.username}
                    </button>
                  ))}
                </div>
              )}
              <div className="tweet-compose-footer">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => setShowTemplates(!showTemplates)}
                    title="Template poruke"
                  >
                    &#128221;
                  </button>
                  <span className="tweet-char-count">{tweetBody.length}/280</span>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!tweetBody.trim() || posting}
                  onClick={handlePost}
                >
                  {t('community.post')}
                </button>
              </div>
              {showTemplates && (
                <div className="tweet-templates">
                  {tweetTemplates.map((tmpl, i) => (
                    <button
                      key={i}
                      className="tweet-template-btn"
                      onClick={() => { setTweetBody(tmpl); setShowTemplates(false); }}
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tweet Feed */}
          <div className="tweet-feed">
            {tweets.length === 0 && (
              <div className="empty-state">{t('community.noPosts')}</div>
            )}
            {tweets.map((tw) => (
              <TweetCard
                key={tw.id}
                tw={tw}
                user={user}
                allUsers={allUsers}
                onDelete={handleDeleteTweet}
                onEdit={handleEditTweet}
                onReact={handleReact}
                onComment={handleComment}
                onDeleteComment={handleDeleteComment}
                onVoteComment={handleVoteComment}
                onUserClick={onUserClick || (() => {})}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && tab === 'projects' && (
        <div className="community-projects-grid">
          {projects.length === 0 && (
            <div className="empty-state">{t('community.noProjects')}</div>
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
