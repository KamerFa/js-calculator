import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../i18n';
import { DB } from '../db';
import radioAudio from '../radioAudio';
import StatusDot from './StatusDot';

const PLAYER_POSITION_OPTIONS = [
  { value: 'bottom-right', label: 'Cozy Corner', desc: 'Floating snugly in the bottom-right' },
  { value: 'top-bar', label: 'Main Stage', desc: 'Pinned proudly across the top' },
];

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: '\u2600' },
  { value: 'dark', label: 'Dark', icon: '\uD83C\uDF19' },
  { value: 'system', label: 'System', icon: '\uD83D\uDCBB' },
];

const LANG_OPTIONS = [
  { value: 'bs', label: 'Bosanski' },
  { value: 'en', label: 'English' },
];

const NOTIF_TYPES = [
  { key: 'task_reminder', label: 'Task reminders', desc: 'When a task is due tomorrow' },
  { key: 'task_overdue', label: 'Overdue alerts', desc: 'When a task passes its due date' },
  { key: 'streak_milestone', label: 'Streak milestones', desc: 'When you hit a streak milestone (7, 30, etc.)' },
  { key: 'task_created', label: 'Task created', desc: 'When a new task is created in your projects' },
  { key: 'task_completed', label: 'Task completed', desc: 'When someone completes a task' },
  { key: 'task_status', label: 'Task status changes', desc: 'When a task status changes' },
  { key: 'project_invite', label: 'Project invites', desc: 'When you are added to a project' },
  { key: 'project_join', label: 'Project joins', desc: 'When someone joins your project' },
  { key: 'tweet_reaction', label: 'Tweet reactions', desc: 'When someone reacts to your post' },
  { key: 'tweet_comment', label: 'Tweet comments', desc: 'When someone comments on your post' },
  { key: 'friend_request', label: 'Friend requests', desc: 'When someone sends you a friend request' },
];

export default function SettingsView({ user }) {
  const { mode, setMode } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const [showProjectsOnProfile, setShowProjectsOnProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playerPosition, setPlayerPosition] = useState(radioAudio.getPlayerPosition());
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [notifPrefs, setNotifPrefs] = useState({});
  const [notifLoaded, setNotifLoaded] = useState(false);

  useEffect(() => {
    DB.getProfile().then((p) => {
      setShowProjectsOnProfile(p.showProjectsOnProfile !== false);
      setShowOnlineStatus(p.showOnlineStatus !== false);
    }).catch(() => {});
    DB.getNotificationPreferences().then((prefs) => {
      setNotifPrefs(prefs);
      setNotifLoaded(true);
    }).catch(() => setNotifLoaded(true));
  }, []);

  const toggleNotifPref = async (key) => {
    const current = notifPrefs[key] !== false; // default is true
    const updated = { ...notifPrefs, [key]: !current };
    setNotifPrefs(updated);
    try {
      await DB.updateNotificationPreferences(updated);
    } catch { /* ignore */ }
  };

  const handleToggleProjects = async () => {
    const next = !showProjectsOnProfile;
    setShowProjectsOnProfile(next);
    setSaving(true);
    try {
      await DB.updateProfile({ showProjectsOnProfile: next });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Appearance</h3>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Theme</span>
              <span className="settings-row-desc">Choose your preferred color scheme</span>
            </div>
            <div className="theme-toggle-group">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`theme-toggle-btn${mode === opt.value ? ' theme-toggle-active' : ''}`}
                  onClick={() => setMode(opt.value)}
                >
                  <span className="theme-toggle-icon">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Radio Vibes</h3>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Player Hangout Spot</span>
              <span className="settings-row-desc">Where should the mini player chill when you're not on the radio page?</span>
            </div>
            <div className="theme-toggle-group">
              {PLAYER_POSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`theme-toggle-btn${playerPosition === opt.value ? ' theme-toggle-active' : ''}`}
                  onClick={() => { setPlayerPosition(opt.value); radioAudio.setPlayerPosition(opt.value); }}
                  title={opt.desc}
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Language</h3>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">{t('profile.language') || 'Language'}</span>
              <span className="settings-row-desc">Select your preferred language</span>
            </div>
            <div className="settings-select-group">
              {LANG_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`theme-toggle-btn${language === opt.value ? ' theme-toggle-active' : ''}`}
                  onClick={() => setLanguage(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Privacy</h3>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Show projects on profile</span>
              <span className="settings-row-desc">
                {showProjectsOnProfile
                  ? 'Your public projects are visible on your profile'
                  : 'Your projects are hidden from your profile'}
              </span>
            </div>
            <label className="toggle-row" onClick={handleToggleProjects}>
              <span className={`toggle-switch${showProjectsOnProfile ? ' on' : ''}`}>
                <span className="toggle-knob" />
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Online Status</h3>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">
                <StatusDot presence="active" size={10} style={{ marginRight: 6 }} />
                Show online status
              </span>
              <span className="settings-row-desc">
                {showOnlineStatus
                  ? 'Others can see when you\'re active'
                  : 'Your online status is hidden from others'}
              </span>
            </div>
            <label className="toggle-row" onClick={async () => {
              const next = !showOnlineStatus;
              setShowOnlineStatus(next);
              setSaving(true);
              try { await DB.updateProfile({ showOnlineStatus: next }); } finally { setSaving(false); }
            }}>
              <span className={`toggle-switch${showOnlineStatus ? ' on' : ''}`}>
                <span className="toggle-knob" />
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Notifications</h3>
        <div className="settings-card">
          {notifLoaded && NOTIF_TYPES.map((nt) => (
            <div className="settings-row" key={nt.key}>
              <div className="settings-row-info">
                <span className="settings-row-label">{nt.label}</span>
                <span className="settings-row-desc">{nt.desc}</span>
              </div>
              <label className="toggle-row" onClick={() => toggleNotifPref(nt.key)}>
                <span className={`toggle-switch${notifPrefs[nt.key] !== false ? ' on' : ''}`}>
                  <span className="toggle-knob" />
                </span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Account</h3>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Username</span>
              <span className="settings-row-desc">@{user?.username}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Keyboard Shortcuts</h3>
        <div className="settings-card">
          <div className="settings-shortcuts">
            <div className="settings-shortcut-row">
              <span className="settings-shortcut-keys"><kbd>Space</kbd></span>
              <span>Play / pause radio</span>
            </div>
            <div className="settings-shortcut-row">
              <span className="settings-shortcut-keys"><kbd>Shift</kbd> + <kbd>&uarr;</kbd> <kbd>&darr;</kbd></span>
              <span>Volume up / down</span>
            </div>
            <div className="settings-shortcut-row">
              <span className="settings-shortcut-keys"><kbd>Shift</kbd> + <kbd>M</kbd></span>
              <span>Mute / unmute radio</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
