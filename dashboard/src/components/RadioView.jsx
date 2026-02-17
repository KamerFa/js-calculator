import { useState, useEffect, useCallback } from 'react';
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
  // Naxi genres
  'Pop': '#e84393',
  'Dance': '#e17055',
  'House': '#00b894',
  'Club': '#fd79a8',
  'Cafe': '#a0522d',
  'Love Songs': '#e84393',
  'Rock': '#d63031',
  'Jazz': '#0984e3',
  'Classical': '#6c5ce7',
  'Evergreen': '#00b894',
  'Gold Hits': '#d4a017',
  'Ex-YU': '#2d3436',
  'Boem': '#b33939',
  'R&B': '#6366f1',
  'Fresh': '#00cec9',
  'Latino': '#f39c12',
  'Kids': '#fdcb6e',
};

const NETWORK_COLORS = {
  'SomaFM': '#2a5caa',
  'Naxi': '#e74c3c',
};

const SLEEP_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const modKey = isMac ? '\u2318' : 'Ctrl';

function useRadio() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    return radioAudio.subscribe(() => forceUpdate((n) => n + 1));
  }, []);

  return {
    playing: radioAudio.getStation(),
    volume: radioAudio.getVolume(),
    isPlaying: radioAudio.isPlaying(),
    isPaused: radioAudio.isPaused(),
  };
}

function formatTime(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function RadioView() {
  const { playing, volume, isPaused } = useRadio();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [sleepRemaining, setSleepRemaining] = useState(null);

  const STATIONS = radioAudio.STATIONS;
  const networks = ['all', ...new Set(STATIONS.map((s) => s.network))];
  const favorites = radioAudio.getFavorites();
  const recentStations = radioAudio.getRecentStations();
  const hasFavorites = favorites.length > 0;
  const hasRecent = recentStations.length > 0;

  // Update sleep timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = radioAudio.getSleepTimeRemaining();
      setSleepRemaining(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts: Ctrl/Cmd + R + key (chord-style via Ctrl/Cmd+key)
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      // Ctrl/Cmd + R — toggle play/pause
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (playing) {
          if (isPaused) radioAudio.resume();
          else radioAudio.pause();
        }
      }
      // Ctrl/Cmd + ArrowUp — volume up
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        radioAudio.setVolume(Math.min(1, radioAudio.getVolume() + 0.05));
      }
      // Ctrl/Cmd + ArrowDown — volume down
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        radioAudio.setVolume(Math.max(0, radioAudio.getVolume() - 0.05));
      }
      // Ctrl/Cmd + M — mute/unmute
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        radioAudio.setVolume(radioAudio.getVolume() > 0 ? 0 : 0.7);
      }
      // Ctrl/Cmd + S — stop
      if (e.key === 's' || e.key === 'S') {
        // Only handle if there's a station (don't steal save shortcut otherwise)
        if (playing) {
          e.preventDefault();
          radioAudio.stop();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [playing, isPaused]);

  const play = (station) => {
    setLoading(true);
    setError(null);
    const result = radioAudio.play(station);
    if (result && result.then) {
      result
        .then(() => setLoading(false))
        .catch(() => {
          setError(station.id);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  };

  const filteredStations = STATIONS.filter((s) => {
    if (filter === 'favorites') return favorites.includes(s.id);
    if (filter !== 'all' && s.network !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.genre.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q) || (s.network && s.network.toLowerCase().includes(q));
    }
    return true;
  });

  const StationCard = useCallback(({ s }) => {
    const isFav = radioAudio.isFavorite(s.id);
    const isActive = playing?.id === s.id;
    const isActiveAndPaused = isActive && isPaused;
    return (
      <button
        className={`radio-card${isActive ? ' radio-card-active' : ''}${isActiveAndPaused ? ' radio-card-paused' : ''}`}
        onClick={() => play(s)}
        disabled={loading}
      >
        <div className="radio-card-color" style={{ background: GENRE_COLORS[s.genre] || NETWORK_COLORS[s.network] || '#2a5caa' }} />
        <div className="radio-card-body">
          <div className="radio-card-top">
            <span className="radio-card-name">{s.name}</span>
            <button
              className={`radio-fav-btn${isFav ? ' radio-fav-active' : ''}`}
              onClick={(e) => { e.stopPropagation(); radioAudio.toggleFavorite(s.id); }}
              title={isFav ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFav ? '\u2605' : '\u2606'}
            </button>
          </div>
          <div className="radio-card-meta">
            {s.network && <span className="radio-card-network" style={{ color: NETWORK_COLORS[s.network] || 'var(--text-3)' }}>{s.network}</span>}
            <span className="radio-card-genre-tag" style={{ color: GENRE_COLORS[s.genre] || NETWORK_COLORS[s.network] || '#2a5caa' }}>{s.genre}</span>
          </div>
          <span className="radio-card-desc">{s.desc}</span>
        </div>
        <div className="radio-card-action">
          {isActive && !isActiveAndPaused ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          )}
        </div>
        {error === s.id && <span className="radio-card-error">Failed</span>}
      </button>
    );
  }, [playing, loading, error, favorites, isPaused]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Radio</h1>
            <p className="subtitle">{STATIONS.length} stations across all genres</p>
          </div>
          <div className="radio-header-actions">
            {/* Sleep Timer */}
            <div className="radio-sleep-wrapper">
              <button
                className={`btn btn-sm radio-sleep-btn${radioAudio.hasSleepTimer() ? ' radio-sleep-active' : ''}`}
                onClick={() => setShowSleepMenu(!showSleepMenu)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
                {sleepRemaining ? ` ${formatTime(sleepRemaining)}` : ' Sleep'}
              </button>
              {showSleepMenu && (
                <div className="radio-sleep-menu">
                  <div className="radio-sleep-menu-title">Sleep Timer</div>
                  {SLEEP_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className="radio-sleep-option"
                      onClick={() => { radioAudio.setSleepTimer(opt.value); setShowSleepMenu(false); }}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {radioAudio.hasSleepTimer() && (
                    <button
                      className="radio-sleep-option radio-sleep-cancel"
                      onClick={() => { radioAudio.clearSleepTimer(); setShowSleepMenu(false); }}
                    >
                      Cancel timer
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="radio-shortcuts-hint">
              {modKey}+R: play/pause &middot; {modKey}+&uarr;&darr;: volume &middot; {modKey}+M: mute
            </div>
          </div>
        </div>
      </div>

      {/* Now Playing */}
      {playing && (
        <div className={`radio-now-playing${isPaused ? ' radio-now-paused' : ''}`}>
          {!isPaused && (
            <div className="radio-now-eq">
              <span /><span /><span /><span />
            </div>
          )}
          {isPaused && (
            <button className="radio-resume-btn" onClick={() => radioAudio.resume()} title="Resume">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </button>
          )}
          <div className="radio-now-info">
            <span className="radio-now-name">{playing.name} {isPaused && <span style={{ opacity: 0.5, fontWeight: 400 }}>(paused)</span>}</span>
            <span className="radio-now-genre">{playing.network && `${playing.network} \u00b7 `}{playing.genre} &middot; {playing.desc}</span>
          </div>
          <div className="radio-volume-group">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.7, flexShrink: 0 }}>
              {volume === 0
                ? <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                : <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              }
            </svg>
            <input
              type="range"
              className="radio-volume"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => radioAudio.setVolume(e.target.value)}
              title={`${Math.round(volume * 100)}%`}
            />
            <span className="radio-volume-pct">{Math.round(volume * 100)}%</span>
          </div>
          {!isPaused && (
            <button className="radio-pause-btn" onClick={() => radioAudio.pause()} title="Pause">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            </button>
          )}
          <button className="radio-stop-btn" onClick={() => radioAudio.stop()} title="Stop">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
          </button>
        </div>
      )}

      {/* Search + Filter */}
      <div className="radio-toolbar">
        <div className="radio-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="radio-search-input"
            placeholder="Search stations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="radio-search-clear" onClick={() => setSearch('')}>&times;</button>
          )}
        </div>
      </div>

      {/* Network Filter Tabs */}
      <div className="radio-genre-tabs">
        {hasFavorites && (
          <button
            className={`radio-genre-tab${filter === 'favorites' ? ' radio-genre-tab-active' : ''}`}
            onClick={() => setFilter('favorites')}
            style={filter === 'favorites' ? { background: 'var(--accent)', color: '#fff' } : {}}
          >
            Favorites
          </button>
        )}
        {networks.map((n) => (
          <button
            key={n}
            className={`radio-genre-tab${filter === n ? ' radio-genre-tab-active' : ''}`}
            onClick={() => setFilter(n)}
            style={filter === n && n !== 'all' ? { background: NETWORK_COLORS[n] || 'var(--accent)', color: '#fff' } : {}}
          >
            {n === 'all' ? 'All' : n}
          </button>
        ))}
      </div>

      {/* Recently Played */}
      {hasRecent && filter === 'all' && !search && (
        <div className="radio-section">
          <h3 className="radio-section-label">Recently Played</h3>
          <div className="radio-recent-row">
            {recentStations.map((s) => (
              <button
                key={s.id}
                className={`radio-recent-chip${playing?.id === s.id ? ' radio-recent-active' : ''}`}
                onClick={() => play(s)}
                style={{ borderColor: GENRE_COLORS[s.genre] || NETWORK_COLORS[s.network] || 'var(--border)' }}
              >
                <span className="radio-recent-dot" style={{ background: GENRE_COLORS[s.genre] || NETWORK_COLORS[s.network] }} />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Station Grid */}
      <div className="radio-grid">
        {filteredStations.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            {filter === 'favorites' ? 'No favorites yet. Click the star on any station!' : 'No stations match your search.'}
          </div>
        )}
        {filteredStations.map((s) => (
          <StationCard key={s.id} s={s} />
        ))}
      </div>
    </div>
  );
}
