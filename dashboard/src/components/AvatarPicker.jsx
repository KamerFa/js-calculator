import { getAllAvatars } from '../avatars';
import { useTranslation } from '../i18n';

export default function AvatarPicker({ selected, onSelect, onClose }) {
  const { t } = useTranslation();
  const avatars = getAllAvatars();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card avatar-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('profile.chooseAvatar')}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
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
