import { useState, useEffect } from 'react';
import radioAudio from '../radioAudio';

const GENRE_COLORS = {
  'Chill': '#8b5cf6',
  'Lounge': '#7c3aed',
  'Deep House': '#db2777',
  'Electronic': '#f59e0b',
  'Progressive': '#b45309',
  'Ambient': '#0ea5e9',
  'Hip Hop': '#6366f1',
  'Soul': '#e11d48',
  'Indie': '#16a34a',
  '80s': '#d946ef',
  'Classic Rock': '#ea580c',
  'Americana': '#a16207',
  'Metal': '#dc2626',
};

function useRadio() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    return radioAudio.subscribe(() => forceUpdate((n) => n + 1));
  }, []);

  return {
    playing: radioAudio.getStation(),
    volume: radioAudio.getVolume(),
    isPlaying: radioAudio.isPlaying(),
  };
}

export default function RadioView() {
  const { playing, volume } = useRadio();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const STATIONS = radioAudio.STATIONS;

  const play = (station) => {
    setLoading(true);
    setError(null);

    radioAudio.play(station)
      .then(() => setLoading(false))
      .catch(() => {
        setError(station.id);
        setLoading(false);
      });
  };

  const changeVolume = (val) => {
    radioAudio.setVolume(val);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Radio</h1>
            <p className="subtitle">{STATIONS.length} stations across all genres</p>
          </div>
        </div>
      </div>

      {playing && (
        <div className="radio-now-playing">
          <div className="radio-now-eq">
            <span /><span /><span /><span />
          </div>
          <div className="radio-now-info">
            <span className="radio-now-name">{playing.name}</span>
            <span className="radio-now-genre">{playing.genre}</span>
          </div>
          <input
            type="range"
            className="radio-volume"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => changeVolume(e.target.value)}
            title={`${Math.round(volume * 100)}%`}
          />
          <button className="radio-stop-btn" onClick={() => radioAudio.stop()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
          </button>
        </div>
      )}

      <div className="radio-grid">
        {STATIONS.map((s) => (
          <button
            key={s.id}
            className={`radio-card${playing?.id === s.id ? ' radio-card-active' : ''}`}
            onClick={() => play(s)}
            disabled={loading}
          >
            <div className="radio-card-color" style={{ background: GENRE_COLORS[s.genre] || '#2a5caa' }} />
            <div className="radio-card-body">
              <span className="radio-card-name">{s.name}</span>
              <span className="radio-card-meta">{s.genre}</span>
            </div>
            <div className="radio-card-action">
              {playing?.id === s.id ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              )}
            </div>
            {error === s.id && <span className="radio-card-error">Failed</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
