import { useState, useEffect, useSyncExternalStore } from 'react';
import radioAudio from '../radioAudio';

const GENRE_COLORS = {
  'Pop': '#7c3aed',
  'House': '#db2777',
  'Dance': '#b45309',
  'Club': '#0891b2',
  'Islamic': '#16a34a',
  'Deep House': '#6366f1',
  'Downtempo': '#8b5cf6',
  'Ambient': '#0ea5e9',
  'Electronic': '#f59e0b',
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

  const regional = STATIONS.filter((s) => s.region !== 'Internet' && s.genre !== 'Islamic');
  const islamic = STATIONS.filter((s) => s.genre === 'Islamic');
  const electronic = STATIONS.filter((s) => s.region === 'Internet' && s.genre !== 'Islamic');

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Radio</h1>
            <p className="subtitle">{STATIONS.length} stanica</p>
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

      <div className="radio-section-label">Regionalne stanice</div>
      <div className="radio-grid">
        {regional.map((s) => (
          <button
            key={s.id}
            className={`radio-card${playing?.id === s.id ? ' radio-card-active' : ''}`}
            onClick={() => play(s)}
            disabled={loading}
          >
            <div className="radio-card-color" style={{ background: GENRE_COLORS[s.genre] || '#2a5caa' }} />
            <div className="radio-card-body">
              <span className="radio-card-name">{s.name}</span>
              <span className="radio-card-meta">{s.genre} &middot; {s.region}</span>
            </div>
            <div className="radio-card-action">
              {playing?.id === s.id ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              )}
            </div>
            {error === s.id && <span className="radio-card-error">Greska</span>}
          </button>
        ))}
      </div>

      {islamic.length > 0 && (
        <>
          <div className="radio-section-label">Islamske stanice</div>
          <div className="radio-grid">
            {islamic.map((s) => (
              <button
                key={s.id}
                className={`radio-card${playing?.id === s.id ? ' radio-card-active' : ''}`}
                onClick={() => play(s)}
                disabled={loading}
              >
                <div className="radio-card-color" style={{ background: GENRE_COLORS[s.genre] || '#16a34a' }} />
                <div className="radio-card-body">
                  <span className="radio-card-name">{s.name}</span>
                  <span className="radio-card-meta">{s.genre} &middot; {s.region}</span>
                </div>
                <div className="radio-card-action">
                  {playing?.id === s.id ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  )}
                </div>
                {error === s.id && <span className="radio-card-error">Greska</span>}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="radio-section-label">Electronic</div>
      <div className="radio-grid">
        {electronic.map((s) => (
          <button
            key={s.id}
            className={`radio-card${playing?.id === s.id ? ' radio-card-active' : ''}`}
            onClick={() => play(s)}
            disabled={loading}
          >
            <div className="radio-card-color" style={{ background: GENRE_COLORS[s.genre] || '#6366f1' }} />
            <div className="radio-card-body">
              <span className="radio-card-name">{s.name}</span>
              <span className="radio-card-meta">{s.genre} &middot; {s.region}</span>
            </div>
            <div className="radio-card-action">
              {playing?.id === s.id ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              )}
            </div>
            {error === s.id && <span className="radio-card-error">Greska</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
