import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../i18n';
import { DB } from '../db';
import radioAudio from '../radioAudio';

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

export default function SettingsView({ user }) {
  const { mode, setMode } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const [showProjectsOnProfile, setShowProjectsOnProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playerPosition, setPlayerPosition] = useState(radioAudio.getPlayerPosition());

  useEffect(() => {
    DB.getProfile().then((p) => {
      setShowProjectsOnProfile(p.showProjectsOnProfile !== false);
    }).catch(() => {});
  }, []);

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
            <p className="settings-shortcut-note">Press <kbd>Ctrl</kbd>+<kbd>R</kbd> first to activate radio mode, then:</p>
            <div className="settings-shortcut-row">
              <span className="settings-shortcut-keys"><kbd>Space</kbd></span>
              <span>Play / pause radio</span>
            </div>
            <div className="settings-shortcut-row">
              <span className="settings-shortcut-keys"><kbd>&uarr;</kbd> <kbd>&darr;</kbd></span>
              <span>Volume up / down</span>
            </div>
            <div className="settings-shortcut-row">
              <span className="settings-shortcut-keys"><kbd>M</kbd></span>
              <span>Mute / unmute radio</span>
            </div>
            <div className="settings-shortcut-row">
              <span className="settings-shortcut-keys"><kbd>S</kbd></span>
              <span>Stop radio</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
