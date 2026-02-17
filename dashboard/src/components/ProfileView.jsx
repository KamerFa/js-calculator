import { useState, useEffect, useRef } from 'react';
import { DB } from '../db';
import { useTranslation } from '../i18n';
import { resolveAvatarUrl } from '../avatarUtils';
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
  const [musicService, setMusicService] = useState('');
  const [musicUsername, setMusicUsername] = useState('');
  const [showProjectsOnProfile, setShowProjectsOnProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [userProjects, setUserProjects] = useState([]);
  const fileRef = useRef(null);

  const isOwn = !profileUsername || profileUsername === user?.username;

  useEffect(() => {
    const load = async () => {
      try {
        const p = isOwn ? await DB.getProfile() : await DB.getPublicProfile(profileUsername);
        setProfile(p);
        setBio(p.bio || '');
        setMusicService(p.musicService || '');
        setMusicUsername(p.musicUsername || '');
        setShowProjectsOnProfile(p.showProjectsOnProfile !== false);
      } catch {
        setProfile(null);
      }
    };
    load();
  }, [profileUsername, isOwn]);

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
            {isOwn && <span className="profile-avatar-edit">{t('modal.edit')}</span>}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          </div>

          <div className="profile-info">
            <h2>@{profile.username}</h2>
            <p className="profile-joined">{t('profile.memberSince')} {memberSince}</p>
            {profile.musicService && (
              <MusicBadge service={profile.musicService} username={profile.musicUsername} />
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
