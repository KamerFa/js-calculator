import { useState, useRef, useEffect } from 'react';

const STATIONS = [
  // Regional
  { id: 'naxi', name: 'Naxi Radio', genre: 'Pop', region: 'Beograd', url: 'http://naxi128.streaming.rs:9150/;' },
  { id: 'naxi-house', name: 'Naxi House', genre: 'House', region: 'Beograd', url: 'http://naxidigital-128.streaming.rs:8000/;' },
  { id: 'naxi-dance', name: 'Naxi Dance', genre: 'Dance', region: 'Beograd', url: 'http://naxidigital-128.streaming.rs:8110/;' },
  { id: 'naxi-clubbing', name: 'Naxi Clubbing', genre: 'Club', region: 'Beograd', url: 'http://naxidigital-128.streaming.rs:8090/;' },

  // Islamic Radio
  { id: 'islamic1', name: 'Radio El-Kelimeh', genre: 'Islamic', region: 'Sarajevo', url: 'http://185.47.65.85:8002/;' },
  { id: 'islamic2', name: 'Quran Radio', genre: 'Islamic', region: 'Internet', url: 'http://quraan.us:9996/;' },
  { id: 'islamic3', name: 'Radio Nur', genre: 'Islamic', region: 'BiH', url: 'http://stream.radionur.ba:8000/radionur' },

  // House / Electronic
  { id: 'beatblender', name: 'SomaFM - Beat Blender', genre: 'Deep House', region: 'Internet', url: 'https://ice4.somafm.com/beatblender-128-aac' },
  { id: 'groovesalad', name: 'SomaFM - Groove Salad', genre: 'Downtempo', region: 'Internet', url: 'https://ice5.somafm.com/groovesalad-128-aac' },
  { id: 'spacestation', name: 'SomaFM - Space Station', genre: 'Ambient', region: 'Internet', url: 'https://ice5.somafm.com/spacestation-128-aac' },
  { id: 'defcon', name: 'SomaFM - DEF CON', genre: 'Electronic', region: 'Internet', url: 'https://ice5.somafm.com/defcon-128-aac' },
];

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

export default function RadioView() {
  const [playing, setPlaying] = useState(() => {
    const saved = localStorage.getItem('radio_playing');
    if (saved) {
      try {
        const stationId = JSON.parse(saved);
        return STATIONS.find((s) => s.id === stationId) || null;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('radio_volume');
    return saved ? parseFloat(saved) : 0.7;
  });
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;

    // Resume playing if there was a station playing before
    const savedStation = localStorage.getItem('radio_playing');
    if (savedStation) {
      try {
        const stationId = JSON.parse(savedStation);
        const station = STATIONS.find((s) => s.id === stationId);
        if (station) {
          audioRef.current.src = station.url;
          audioRef.current.play().catch(() => {
            setError(station.id);
            setPlaying(null);
            localStorage.removeItem('radio_playing');
          });
        }
      } catch {
        // ignore
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const play = (station) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing?.id === station.id) {
      audio.pause();
      audio.src = '';
      setPlaying(null);
      setError(null);
      localStorage.removeItem('radio_playing');
      return;
    }

    setLoading(true);
    setError(null);
    audio.pause();
    audio.src = station.url;
    audio.volume = volume;
    audio.play()
      .then(() => {
        setPlaying(station);
        setLoading(false);
        localStorage.setItem('radio_playing', JSON.stringify(station.id));
      })
      .catch(() => {
        setError(station.id);
        setLoading(false);
        setPlaying(null);
        localStorage.removeItem('radio_playing');
      });
  };

  const changeVolume = (val) => {
    const v = parseFloat(val);
    setVolume(v);
    localStorage.setItem('radio_volume', v);
    if (audioRef.current) audioRef.current.volume = v;
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
          <button className="radio-stop-btn" onClick={() => play(playing)}>
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
