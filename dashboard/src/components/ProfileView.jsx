import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { DB } from '../db';
import { useTranslation } from '../i18n';
import { resolveAvatarUrl } from '../avatarUtils';
import StatusDot from './StatusDot';
import { renderWithMentions, useMentions, MentionDropdown } from '../mentions';
import { IconUsers, IconPlus } from './Icons';
import AvatarPicker from './AvatarPicker';

const MUSIC_SERVICES = [
  { value: '', label: 'None' },
  { value: 'spotify', label: 'Spotify', color: '#1DB954', icon: 'S' },
  { value: 'youtube', label: 'YouTube Music', color: '#FF0000', icon: 'Y' },
  { value: 'tidal', label: 'Tidal', color: '#000000', icon: 'T' },
];

function MusicBadge({ service, username }) {
  const svc = MUSIC_SERVICES.find((s) => s.value === service);
  if (!svc || !service) return null;

  let url = '#';
  if (service === 'spotify') url = `https://open.spotify.com/user/${username}`;
  else if (service === 'youtube') url = `https://music.youtube.com/channel/${username}`;
  else if (service === 'tidal') url = `https://tidal.com/browse/user/${username}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="music-badge"
      style={{ '--music-color': svc.color }}
    >
      <span className="music-badge-icon">{svc.icon}</span>
      <span className="music-badge-label">{svc.label}</span>
      {username && <span className="music-badge-user">@{username}</span>}
    </a>
  );
}

export default function ProfileView({ user, profileUsername, onProjectClick, onReload }) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [nickname, setNickname] = useState('');
  const [musicService, setMusicService] = useState('');
  const [musicUsername, setMusicUsername] = useState('');
  const [showProjectsOnProfile, setShowProjectsOnProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [userProjects, setUserProjects] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [friendStatus, setFriendStatus] = useState(null);
  const [myNickname, setMyNickname] = useState('');
  const [editingNickname, setEditingNickname] = useState(false);
  const [friends, setFriends] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const fileRef = useRef(null);
  const commentRef = useRef(null);
  const navigate = useNavigate();
  const mentions = useMentions(allUsers, user);

  const isOwn = !profileUsername || profileUsername === user?.username;

  useEffect(() => {
    const load = async () => {
      try {
        const p = isOwn ? await DB.getProfile() : await DB.getPublicProfile(profileUsername);
        setProfile(p);
        setBio(p.bio || '');
        setNickname(p.nickname || '');
        setMusicService(p.musicService || '');
        setMusicUsername(p.musicUsername || '');
        setShowProjectsOnProfile(p.showProjectsOnProfile !== false);
        if (!isOwn) {
          setFriendStatus(p.friendStatus || null);
          setMyNickname(p.myNickname || '');
        }
      } catch {
        setProfile(null);
      }
    };
    load();
  }, [profileUsername, isOwn]);

  // Load profile comments
  useEffect(() => {
    const username = isOwn ? user?.username : profileUsername;
    if (username) {
      DB.getProfileComments(username).then(setComments).catch(() => setComments([]));
    }
  }, [profileUsername, isOwn, user?.username]);

  // Load friends list (own profile)
  useEffect(() => {
    if (isOwn) {
      DB.getFriends().then(setFriends).catch(() => setFriends([]));
    }
  }, [isOwn]);

  // Load users for mentions
  useEffect(() => {
    if (allUsers.length === 0) {
      DB.getUsers().then(setAllUsers).catch(() => {});
    }
  }, []);

  // Load user's public projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const username = isOwn ? user?.username : profileUsername;
        if (username) {
          const projects = await DB.getUserProjects(username);
          setUserProjects(projects);
        }
      } catch {
        setUserProjects([]);
      }
    };
    loadProjects();
  }, [profileUsername, isOwn, user?.username]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await DB.updateProfile({
        bio,
        nickname: nickname || null,
        musicService: musicService || null,
        musicUsername: musicUsername || null,
        showProjectsOnProfile,
      });
      const p = await DB.getProfile();
      setProfile(p);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentBody.trim()) return;
    const username = isOwn ? user?.username : profileUsername;
    const comment = await DB.postProfileComment(username, commentBody.trim());
    setComments((prev) => [comment, ...prev]);
    setCommentBody('');
  };

  const handleDeleteComment = async (id) => {
    await DB.deleteProfileComment(id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const handleFriendAction = async () => {
    if (!profile) return;
    if (friendStatus === 'friends') {
      await DB.removeFriend(profile.id);
      setFriendStatus(null);
    } else if (friendStatus === 'pending_sent') {
      await DB.removeFriend(profile.id);
      setFriendStatus(null);
    } else if (friendStatus === 'pending_received') {
      await DB.acceptFriendRequest(profile.id);
      setFriendStatus('friends');
    } else {
      const result = await DB.sendFriendRequest(profile.id);
      setFriendStatus(result.status);
    }
  };

  const handleSaveNickname = async () => {
    if (!profile) return;
    await DB.setNickname(profile.id, myNickname.trim());
    setEditingNickname(false);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { avatarUrl } = await DB.uploadAvatar(file);
    setProfile((prev) => ({ ...prev, avatarUrl }));
  };

  const handleAvatarSelect = async (url, index) => {
    // index = -1 means external URL, otherwise preset avatar
    const avatarRef = index >= 0 ? `avatar:${index}` : url;
    await DB.updateProfile({
      bio: profile.bio,
      musicService: profile.musicService || null,
      musicUsername: profile.musicUsername || null,
      avatarUrl: avatarRef,
    });
    setProfile((prev) => ({ ...prev, avatarUrl: avatarRef }));
  };

  const handleJoinProject = async (projectId) => {
    try {
      await DB.joinCommunityProject(projectId);
      // Refresh the projects list
      const username = isOwn ? user?.username : profileUsername;
      if (username) {
        const projects = await DB.getUserProjects(username);
        setUserProjects(projects);
      }
      if (onReload) onReload();
    } catch {
      // ignore
    }
  };

  if (!profile) {
    return (
      <div>
        <div className="page-header"><h1>{t('profile.title')}</h1></div>
        <div className="empty-state">{t('common.loading')}</div>
      </div>
    );
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString(undefined, {
    month: 'long', year: 'numeric',
  });

  const avatarSrc = resolveAvatarUrl(profile.avatarUrl);

  return (
    <div>
      <div className="page-header">
        <h1>{isOwn ? t('profile.myProfile') : `@${profile.username}`}</h1>
      </div>

      <div className="profile-card">
        <div className="profile-card-top">
          <div className="profile-avatar-wrapper" onClick={() => isOwn && setShowAvatarPicker(true)}>
            {avatarSrc ? (
              <img src={avatarSrc} alt="Avatar" className="profile-avatar-img" />
            ) : (
              <div className="profile-avatar-placeholder">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            <StatusDot
              presence={profile.presence || 'offline'}
              size={18}
              statusEmoji={profile.statusEmoji}
              statusText={profile.statusText}
              style={{ position: 'absolute', bottom: 2, right: 2, border: '3px solid var(--surface)', borderRadius: '50%', boxSizing: 'content-box' }}
            />
            {isOwn && <span className="profile-avatar-edit">{t('modal.edit')}</span>}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          </div>

          <div className="profile-info">
            <h2>
              @{profile.username}
              {profile.nickname && <span className="profile-nickname"> ({profile.nickname})</span>}
            </h2>
            {(profile.statusEmoji || profile.statusText) && (
              <p className="profile-custom-status">
                {profile.statusEmoji && <span>{profile.statusEmoji}</span>}
                {profile.statusText && <span>{profile.statusText}</span>}
              </p>
            )}
            <p className="profile-joined">{t('profile.memberSince')} {memberSince}</p>
            {profile.musicService && (
              <MusicBadge service={profile.musicService} username={profile.musicUsername} />
            )}
            {!isOwn && (
              <div className="profile-actions-row">
                <button
                  className={`btn btn-sm${friendStatus === 'friends' ? ' btn-friend-active' : friendStatus === 'pending_sent' ? ' btn-friend-pending' : ''}`}
                  onClick={handleFriendAction}
                >
                  {friendStatus === 'friends' ? 'Ahbab \u2665' :
                   friendStatus === 'pending_sent' ? 'Request Sent' :
                   friendStatus === 'pending_received' ? 'Accept Request' :
                   'Add Habib'}
                </button>
                {friendStatus === 'pending_received' && (
                  <button className="btn btn-sm" onClick={() => DB.removeFriend(profile.id).then(() => setFriendStatus(null))}>
                    Decline
                  </button>
                )}
                <button className="btn btn-sm" onClick={() => setEditingNickname(!editingNickname)}>
                  {myNickname ? `Nickname: ${myNickname}` : 'Set Nickname'}
                </button>
              </div>
            )}
            {editingNickname && !isOwn && (
              <div className="profile-nickname-edit">
                <input
                  className="form-input"
                  type="text"
                  value={myNickname}
                  onChange={(e) => setMyNickname(e.target.value.slice(0, 30))}
                  placeholder="Private nickname for this user"
                />
                <button className="btn btn-sm btn-primary" onClick={handleSaveNickname}>Save</button>
                <button className="btn btn-sm" onClick={() => setEditingNickname(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        {!editing ? (
          <div className="profile-bio-section">
            <p className="profile-bio">{profile.bio || (isOwn ? t('profile.noBioOwn') : t('profile.noBio'))}</p>
            {isOwn && (
              <button className="btn btn-sm" onClick={() => setEditing(true)}>{t('profile.editProfile')}</button>
            )}
          </div>
        ) : (
          <div className="profile-edit-section">
            <div className="form-group">
              <label>Nickname</label>
              <input
                className="form-input"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 30))}
                placeholder="Display name (optional)"
              />
            </div>
            <div className="form-group">
              <label>{t('profile.bio')}</label>
              <textarea
                className="form-textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 300))}
                placeholder={t('profile.bioPlaceholder')}
                rows={3}
              />
              <span className="tweet-char-count">{bio.length}/300</span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('profile.musicService')}</label>
                <select className="form-select" value={musicService} onChange={(e) => setMusicService(e.target.value)}>
                  {MUSIC_SERVICES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t('profile.musicUsername')}</label>
                <input
                  className="form-input"
                  type="text"
                  value={musicUsername}
                  onChange={(e) => setMusicUsername(e.target.value)}
                  placeholder={musicService === 'spotify' ? 'Spotify username' : musicService === 'youtube' ? 'Channel ID' : musicService === 'tidal' ? 'Tidal username' : t('profile.selectService')}
                  disabled={!musicService}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="toggle-row" onClick={() => setShowProjectsOnProfile(!showProjectsOnProfile)}>
                <span className={`toggle-switch${showProjectsOnProfile ? ' on' : ''}`}>
                  <span className="toggle-knob" />
                </span>
                <span className="toggle-label">
                  <span>Show projects on profile</span>
                  <span className="toggle-hint">
                    {showProjectsOnProfile
                      ? 'Your public projects are visible on your profile'
                      : 'Your projects are hidden from your profile'}
                  </span>
                </span>
              </label>
            </div>

            <div className="profile-edit-actions">
              <button className="btn" onClick={() => setEditing(false)}>{t('modal.cancel')}</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? t('common.loading') : t('modal.save')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Public Projects Section */}
      {userProjects.length > 0 && (
        <div className="profile-projects-section">
          <h3 className="profile-projects-title">
            {isOwn ? 'My Public Projects' : `@${profile.username}'s Projects`}
          </h3>
          <div className="profile-projects-grid">
            {userProjects.map((p) => (
              <div className="profile-project-card" key={p.id}>
                <div className="profile-project-header">
                  <span className="project-dot" style={{ background: p.color }} />
                  <span className="profile-project-name">{p.name}</span>
                  {p.isGlobal && <span className="community-global-tag">Global</span>}
                </div>
                {p.description && (
                  <p className="profile-project-desc">{p.description}</p>
                )}
                <div className="profile-project-stats">
                  <span><IconUsers /> {p.memberCount} members</span>
                  <span>{p.doneCount}/{p.taskCount} tasks done</span>
                </div>
                <div className="profile-project-footer">
                  {p.isMember ? (
                    <button className="btn btn-sm" onClick={() => onProjectClick && onProjectClick(p.id)}>
                      View Project
                    </button>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={() => handleJoinProject(p.id)}>
                      <IconPlus size={12} /> Join
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ahbab (Friends) - own profile */}
      {isOwn && (friends.length > 0 || friends.some((f) => f.status === 'pending' && f.direction === 'received')) && (
        <div className="profile-friends-section">
          <h3 className="profile-section-title">Ahbab ({friends.filter((f) => f.status === 'accepted').length})</h3>
          {friends.filter((f) => f.status === 'pending' && f.direction === 'received').length > 0 && (
            <div className="profile-friend-requests">
              <h4>Pending Requests</h4>
              {friends.filter((f) => f.status === 'pending' && f.direction === 'received').map((f) => (
                <div className="profile-friend-row" key={f.id}>
                  <span className="profile-friend-name">@{f.username}</span>
                  <button className="btn btn-sm btn-primary" onClick={async () => {
                    await DB.acceptFriendRequest(f.id);
                    const updated = await DB.getFriends();
                    setFriends(updated);
                  }}>Accept</button>
                  <button className="btn btn-sm" onClick={async () => {
                    await DB.removeFriend(f.id);
                    const updated = await DB.getFriends();
                    setFriends(updated);
                  }}>Decline</button>
                </div>
              ))}
            </div>
          )}
          <div className="profile-friends-grid">
            {friends.filter((f) => f.status === 'accepted').map((f) => (
              <div className="profile-friend-card" key={f.id} onClick={() => onProjectClick && window.location.assign(`/profile/${f.username}`)}>
                {f.avatarUrl ? (
                  <img src={resolveAvatarUrl(f.avatarUrl)} alt="" className="profile-friend-avatar" />
                ) : (
                  <div className="profile-friend-avatar-placeholder">{f.username.charAt(0).toUpperCase()}</div>
                )}
                <span className="profile-friend-name">
                  {f.nickname || f.username}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Comments */}
      <div className="profile-comments-section">
        <h3 className="profile-section-title">Comments ({comments.length})</h3>
        <div className="profile-comment-form" style={{ position: 'relative' }}>
          <textarea
            ref={commentRef}
            className="form-textarea"
            value={commentBody}
            onChange={(e) => {
              setCommentBody(e.target.value.slice(0, 500));
              mentions.detectMention(e.target.value, e.target.selectionStart);
            }}
            placeholder="Leave a comment... (@ to mention)"
            rows={2}
          />
          <MentionDropdown mentions={mentions} onSelect={(username) => {
            const el = commentRef.current;
            const newVal = mentions.insertMention(username, commentBody, el?.selectionStart || commentBody.length);
            setCommentBody(newVal);
          }} />
          <button className="btn btn-primary btn-sm" onClick={handlePostComment} disabled={!commentBody.trim()}>
            Post
          </button>
        </div>
        {comments.length === 0 && (
          <div className="profile-comments-empty">No comments yet. Be the first!</div>
        )}
        {comments.map((c) => (
          <div className="profile-comment" key={c.id}>
            <div className="profile-comment-header">
              {c.authorAvatar ? (
                <img src={resolveAvatarUrl(c.authorAvatar)} alt="" className="profile-comment-avatar" />
              ) : (
                <span className="profile-comment-avatar profile-comment-avatar-placeholder">
                  {c.authorUsername.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="profile-comment-author">@{c.authorUsername}</span>
              <span className="profile-comment-time">
                {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              {(c.authorId === user?.id || (isOwn && profile)) && (
                <button className="profile-comment-delete" onClick={() => handleDeleteComment(c.id)}>
                  &times;
                </button>
              )}
            </div>
            <p className="profile-comment-body">{renderWithMentions(c.body, (u) => navigate(`/profile/${u}`))}</p>
          </div>
        ))}
      </div>

      {showAvatarPicker && (
        <AvatarPicker
          selected={avatarSrc}
          onSelect={handleAvatarSelect}
          onUpload={() => { setShowAvatarPicker(false); fileRef.current?.click(); }}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
    </div>
  );
}

export { MusicBadge };
