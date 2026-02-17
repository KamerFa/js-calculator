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
};

const SLEEP_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
];

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

function formatTime(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function RadioView() {
  const { playing, volume } = useRadio();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [sleepRemaining, setSleepRemaining] = useState(null);

  const STATIONS = radioAudio.STATIONS;
  const genres = ['all', ...new Set(STATIONS.map((s) => s.genre))];
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Don't capture if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space' && playing) {
        e.preventDefault();
        radioAudio.play(playing); // toggle
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const v = Math.min(1, radioAudio.getVolume() + 0.05);
        radioAudio.setVolume(v);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const v = Math.max(0, radioAudio.getVolume() - 0.05);
        radioAudio.setVolume(v);
      }
      if (e.key === 'm' || e.key === 'M') {
        radioAudio.setVolume(radioAudio.getVolume() > 0 ? 0 : 0.7);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [playing]);

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

  const filteredStations = STATIONS.filter((s) => {
    if (filter === 'favorites') return favorites.includes(s.id);
    if (filter !== 'all' && s.genre !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.genre.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q);
    }
    return true;
  });

  const StationCard = useCallback(({ s }) => {
    const isFav = radioAudio.isFavorite(s.id);
    const isActive = playing?.id === s.id;
    return (
      <button
        className={`radio-card${isActive ? ' radio-card-active' : ''}`}
        onClick={() => play(s)}
        disabled={loading}
      >
        <div className="radio-card-color" style={{ background: GENRE_COLORS[s.genre] || '#2a5caa' }} />
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
          <span className="radio-card-genre-tag" style={{ color: GENRE_COLORS[s.genre] || '#2a5caa' }}>{s.genre}</span>
          <span className="radio-card-desc">{s.desc}</span>
        </div>
        <div className="radio-card-action">
          {isActive ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          )}
        </div>
        {error === s.id && <span className="radio-card-error">Failed</span>}
      </button>
    );
  }, [playing, loading, error, favorites]);

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
              Space: play/pause &middot; Arrows: volume &middot; M: mute
            </div>
          </div>
        </div>
      </div>

      {/* Now Playing */}
      {playing && (
        <div className="radio-now-playing">
          <div className="radio-now-eq">
            <span /><span /><span /><span />
          </div>
          <div className="radio-now-info">
            <span className="radio-now-name">{playing.name}</span>
            <span className="radio-now-genre">{playing.genre} &middot; {playing.desc}</span>
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
          <button className="radio-stop-btn" onClick={() => radioAudio.stop()}>
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

      {/* Genre Filter Tabs */}
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
        {genres.map((g) => (
          <button
            key={g}
            className={`radio-genre-tab${filter === g ? ' radio-genre-tab-active' : ''}`}
            onClick={() => setFilter(g)}
            style={filter === g && g !== 'all' ? { background: GENRE_COLORS[g] || 'var(--accent)', color: '#fff' } : {}}
          >
            {g === 'all' ? 'All' : g}
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
                style={{ borderColor: GENRE_COLORS[s.genre] || 'var(--border)' }}
              >
                <span className="radio-recent-dot" style={{ background: GENRE_COLORS[s.genre] }} />
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
