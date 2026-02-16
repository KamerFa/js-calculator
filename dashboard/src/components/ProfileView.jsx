import { useState, useEffect, useRef } from 'react';
import { DB } from '../db';

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

export default function ProfileView({ user, profileUsername }) {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [musicService, setMusicService] = useState('');
  const [musicUsername, setMusicUsername] = useState('');
  const [saving, setSaving] = useState(false);
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
      } catch {
        setProfile(null);
      }
    };
    load();
  }, [profileUsername, isOwn]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await DB.updateProfile({ bio, musicService: musicService || null, musicUsername: musicUsername || null });
      const p = await DB.getProfile();
      setProfile(p);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { avatarUrl } = await DB.uploadAvatar(file);
    setProfile((prev) => ({ ...prev, avatarUrl }));
  };

  if (!profile) {
    return (
      <div>
        <div className="page-header"><h1>Profile</h1></div>
        <div className="empty-state">Loading...</div>
      </div>
    );
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  return (
    <div>
      <div className="page-header">
        <h1>{isOwn ? 'My Profile' : `@${profile.username}`}</h1>
      </div>

      <div className="profile-card">
        <div className="profile-card-top">
          <div className="profile-avatar-wrapper" onClick={() => isOwn && fileRef.current?.click()}>
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className="profile-avatar-img" />
            ) : (
              <div className="profile-avatar-placeholder">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            {isOwn && <span className="profile-avatar-edit">Edit</span>}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatar} />
          </div>

          <div className="profile-info">
            <h2>@{profile.username}</h2>
            <p className="profile-joined">Member since {memberSince}</p>
            {profile.musicService && (
              <MusicBadge service={profile.musicService} username={profile.musicUsername} />
            )}
          </div>
        </div>

        {!editing ? (
          <div className="profile-bio-section">
            <p className="profile-bio">{profile.bio || (isOwn ? 'No bio yet. Click edit to add one!' : 'No bio yet.')}</p>
            {isOwn && (
              <button className="btn btn-sm" onClick={() => setEditing(true)}>Edit Profile</button>
            )}
          </div>
        ) : (
          <div className="profile-edit-section">
            <div className="form-group">
              <label>Bio</label>
              <textarea
                className="form-textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 300))}
                placeholder="Tell us about yourself (300 chars max)"
                rows={3}
              />
              <span className="tweet-char-count">{bio.length}/300</span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Music Service</label>
                <select className="form-select" value={musicService} onChange={(e) => setMusicService(e.target.value)}>
                  {MUSIC_SERVICES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Username / ID</label>
                <input
                  className="form-input"
                  type="text"
                  value={musicUsername}
                  onChange={(e) => setMusicUsername(e.target.value)}
                  placeholder={musicService === 'spotify' ? 'Spotify username' : musicService === 'youtube' ? 'Channel ID' : musicService === 'tidal' ? 'Tidal username' : 'Select a service first'}
                  disabled={!musicService}
                />
              </div>
            </div>

            <div className="profile-edit-actions">
              <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { MusicBadge };
