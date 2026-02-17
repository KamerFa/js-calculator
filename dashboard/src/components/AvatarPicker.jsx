import { useState } from 'react';
import { getAllAvatars } from '../avatars';
import { useTranslation } from '../i18n';

export default function AvatarPicker({ selected, onSelect, onUpload, onClose }) {
  const { t } = useTranslation();
  const avatars = getAllAvatars();
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');

  const handleUrlSubmit = () => {
    const url = urlInput.trim();
    if (!url) return;
    try {
      new URL(url);
      if (!/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)/i.test(url) && !url.includes('imgur') && !url.includes('i.ibb') && !url.includes('gravatar') && !url.includes('avatars.githubusercontent')) {
        setUrlError('URL should point to an image');
        return;
      }
      setUrlError('');
      onSelect(url, -1);
      onClose();
    } catch {
      setUrlError('Invalid URL');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card avatar-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('profile.chooseAvatar')}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {/* Paste URL section */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>
              Paste image URL (imgur, imgbb, etc.)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                type="url"
                placeholder="https://i.imgur.com/example.jpg"
                value={urlInput}
                onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
                Use
              </button>
            </div>
            {urlError && <span style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4, display: 'block' }}>{urlError}</span>}
          </div>

          {/* Upload from device */}
          {onUpload && (
            <div style={{ marginBottom: 16 }}>
              <button className="btn btn-sm" onClick={onUpload} style={{ width: '100%' }}>
                Upload from device
              </button>
            </div>
          )}

          {/* Preset avatars */}
          <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 8 }}>
            Or choose a preset
          </label>
          <div className="avatar-grid">
            {avatars.map((avatar) => (
              <button
                key={avatar.index}
                className={`avatar-grid-item${selected === avatar.url ? ' selected' : ''}`}
                onClick={() => { onSelect(avatar.url, avatar.index); onClose(); }}
              >
                <img src={avatar.url} alt={`Avatar ${avatar.index + 1}`} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
