import { useState, useEffect } from 'react';
import { DB } from '../db';
import { IconUsers, IconPlus } from './Icons';

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

export default function CommunityView({ user, onProjectClick, onReload }) {
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
      {/* ── Ramadan Banner ── */}
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
                Join Ramadan 2026
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

      {/* ── Tabs ── */}
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
          {/* ── Compose tweet ── */}
          <div className="tweet-compose">
            <div className="tweet-compose-avatar">
              {user?.username?.charAt(0).toUpperCase()}
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

          {/* ── Tweet Feed ── */}
          <div className="tweet-feed">
            {tweets.length === 0 && (
              <div className="empty-state">No tweets yet. Be the first to post!</div>
            )}
            {tweets.map((tw) => (
              <div className="tweet-card" key={tw.id}>
                <div className="tweet-avatar">
                  {tw.username.charAt(0).toUpperCase()}
                </div>
                <div className="tweet-content">
                  <div className="tweet-header">
                    <span className="tweet-username">@{tw.username}</span>
                    <span className="tweet-time">{timeAgo(tw.createdAt)}</span>
                    {tw.userId === user?.id && (
                      <button className="tweet-delete" onClick={() => handleDeleteTweet(tw.id)}>&times;</button>
                    )}
                  </div>
                  <p className="tweet-body">{tw.body}</p>
                </div>
              </div>
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
