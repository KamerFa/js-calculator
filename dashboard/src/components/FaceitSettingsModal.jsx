import { useState, useEffect } from 'react';
import { IconX } from './Icons';
import { FaceitAPI } from '../faceit';

export default function FaceitSettingsModal({ open, onClose, onSaved }) {
  const [apiKey, setApiKey] = useState('');
  const [nickname, setNickname] = useState('');
  const [game, setGame] = useState('cs2');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!open) return;
    const cfg = FaceitAPI.getConfig();
    setApiKey(cfg.apiKey || '');
    setNickname(cfg.nickname || '');
    setGame(cfg.game || 'cs2');
    setStatus('');
  }, [open]);

  if (!open) return null;

  const handleTest = async () => {
    if (!apiKey.trim() || !nickname.trim()) {
      setStatus('Fill in both API key and nickname.');
      return;
    }
    setStatus('Testing...');
    // Temporarily save so the API module picks it up
    FaceitAPI.saveConfig({ apiKey: apiKey.trim(), nickname: nickname.trim(), game });
    try {
      const player = await FaceitAPI.getPlayer(nickname.trim());
      if (player.player_id) {
        FaceitAPI.saveConfig({
          apiKey: apiKey.trim(),
          nickname: nickname.trim(),
          game,
          playerId: player.player_id,
          avatar: player.avatar || '',
          country: player.country || '',
        });
        setStatus(`Connected! Player: ${player.nickname} (ELO: ${player.games?.[game]?.faceit_elo || '?'})`);
      } else {
        setStatus('Player not found. Check the nickname.');
      }
    } catch (err) {
      setStatus('Error: ' + err.message);
    }
  };

  const handleSave = () => {
    FaceitAPI.saveConfig({
      ...FaceitAPI.getConfig(),
      apiKey: apiKey.trim(),
      nickname: nickname.trim(),
      game,
    });
    onSaved?.();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>FACEIT Settings</h2>
          <button className="modal-close" onClick={onClose}><IconX /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
            Get your API key from{' '}
            <a href="https://developers.faceit.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
              developers.faceit.com
            </a>
            {' '}(create an app, use the Server-side API key).
          </p>
          <div className="form-group">
            <label>API Key</label>
            <input
              className="form-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Nickname</label>
              <input className="form-input" type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Your FACEIT name" />
            </div>
            <div className="form-group">
              <label>Game</label>
              <select className="form-select" value={game} onChange={(e) => setGame(e.target.value)}>
                <option value="cs2">CS2</option>
                <option value="csgo">CS:GO</option>
              </select>
            </div>
          </div>
          {status && (
            <p style={{
              fontSize: 12,
              padding: '8px 12px',
              borderRadius: 'var(--radius)',
              marginBottom: 12,
              background: status.startsWith('Error') || status.startsWith('Fill') ? 'var(--danger-bg)' : status.startsWith('Connected') ? 'var(--success-bg)' : 'var(--bg)',
              color: status.startsWith('Error') || status.startsWith('Fill') ? 'var(--danger)' : status.startsWith('Connected') ? 'var(--success)' : 'var(--text-2)',
            }}>
              {status}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={handleTest}>Test Connection</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
