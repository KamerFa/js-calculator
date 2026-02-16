import { useState, useRef, useEffect } from 'react';

const STATIONS = [
  { id: 'radio8', name: 'Radio 8', genre: 'Pop / Urban', region: 'Sarajevo', url: 'https://streamingv2.shoutcast.com/Radio8Sarajevo' },
  { id: 'tnt', name: 'Radio TNT', genre: 'Pop / Hits', region: 'BiH', url: 'https://radio.itdsolutions.ba:8002/tntradio' },
  { id: 'naxi', name: 'Naxi Radio', genre: 'Pop', region: 'Beograd', url: 'https://naxi128.streaming.rs:9152/' },
  { id: 'naxi-house', name: 'Naxi House', genre: 'House', region: 'Beograd', url: 'https://naxidigital128.streaming.rs:8002/' },
  { id: 'naxi-dance', name: 'Naxi Dance', genre: 'Dance', region: 'Beograd', url: 'https://naxidigital128.streaming.rs:8112/' },
  { id: 'naxi-clubbing', name: 'Naxi Clubbing', genre: 'Club / Techno', region: 'Beograd', url: 'https://naxidigital128.streaming.rs:8092/' },
  { id: 'thetrip', name: 'SomaFM - The Trip', genre: 'Progressive House', region: 'Internet', url: 'https://ice4.somafm.com/thetrip-128-aac' },
  { id: 'beatblender', name: 'SomaFM - Beat Blender', genre: 'Deep House / Chill', region: 'Internet', url: 'https://ice4.somafm.com/beatblender-128-aac' },
];

const GENRE_COLORS = {
  'Pop / Urban': '#2a5caa',
  'Pop / Hits': '#c0392b',
  'Pop': '#7c3aed',
  'House': '#db2777',
  'Dance': '#b45309',
  'Club / Techno': '#0891b2',
  'Progressive House': '#276749',
  'Deep House / Chill': '#6366f1',
};

export default function RadioView() {
  const [playing, setPlaying] = useState(null);
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
      })
      .catch(() => {
        setError(station.id);
        setLoading(false);
        setPlaying(null);
      });
  };

  const changeVolume = (val) => {
    const v = parseFloat(val);
    setVolume(v);
    localStorage.setItem('radio_volume', v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const regional = STATIONS.filter((s) => s.region !== 'Internet');
  const house = STATIONS.filter((s) => s.region === 'Internet' || s.genre.toLowerCase().includes('house') || s.genre.toLowerCase().includes('club') || s.genre.toLowerCase().includes('dance'));

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

      <div className="radio-section-label">House / Electronic</div>
      <div className="radio-grid">
        {house.map((s) => (
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
