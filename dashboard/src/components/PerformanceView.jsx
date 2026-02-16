import { useState, useEffect, useCallback } from 'react';
import { FaceitAPI } from '../faceit';

export default function PerformanceView({ onOpenSettings }) {
  const [config, setConfig] = useState(FaceitAPI.getConfig());
  const [player, setPlayer] = useState(null);
  const [stats, setStats] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchStats, setMatchStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isConfigured = config.apiKey && config.nickname;

  const refresh = useCallback(async () => {
    const cfg = FaceitAPI.getConfig();
    setConfig(cfg);
    if (!cfg.apiKey || !cfg.nickname) return;

    setLoading(true);
    setError('');
    try {
      // Resolve player if we don't have the ID cached
      let playerId = cfg.playerId;
      if (!playerId) {
        const p = await FaceitAPI.getPlayer(cfg.nickname);
        playerId = p.player_id;
        FaceitAPI.saveConfig({ ...cfg, playerId });
      }

      const [playerData, statsData, historyData] = await Promise.all([
        FaceitAPI.getPlayer(cfg.nickname),
        FaceitAPI.getPlayerStats(playerId, cfg.game || 'cs2'),
        FaceitAPI.getMatchHistory(playerId, cfg.game || 'cs2', 20),
      ]);

      setPlayer(playerData);
      setStats(statsData);
      setMatches(historyData.items || []);

      // Fetch detailed stats for first 10 matches
      const first10 = (historyData.items || []).slice(0, 10);
      const detailed = {};
      await Promise.allSettled(
        first10.map(async (m) => {
          try {
            const ms = await FaceitAPI.getMatchStats(m.match_id);
            detailed[m.match_id] = ms;
          } catch { /* skip */ }
        })
      );
      setMatchStats(detailed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Re-check config when settings modal closes
  useEffect(() => {
    const interval = setInterval(() => {
      const cfg = FaceitAPI.getConfig();
      if (cfg.apiKey !== config.apiKey || cfg.nickname !== config.nickname) {
        refresh();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [config, refresh]);

  const game = config.game || 'cs2';
  const elo = player?.games?.[game]?.faceit_elo;
  const skillLevel = player?.games?.[game]?.skill_level;
  const lifetime = stats?.lifetime;

  // Find your stats from match detail
  const findMyStats = (matchId) => {
    const ms = matchStats[matchId];
    if (!ms?.rounds?.[0]?.teams) return null;
    const playerId = config.playerId;
    for (const team of ms.rounds[0].teams) {
      for (const p of team.players || []) {
        if (p.player_id === playerId) return p.player_stats;
      }
    }
    return null;
  };

  // Did the player win?
  const didWin = (match) => {
    const playerId = config.playerId;
    const t1 = match.teams?.faction1;
    const t2 = match.teams?.faction2;
    const isT1 = t1?.players?.some((p) => p.player_id === playerId);
    const winner = match.results?.winner;
    if (isT1) return winner === 'faction1';
    return winner === 'faction2';
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!isConfigured) {
    return (
      <div>
        <div className="page-header">
          <h1>Performance</h1>
          <p className="subtitle">Track your FACEIT match performance</p>
        </div>
        <div className="empty-state">
          <p style={{ marginBottom: 16 }}>Connect your FACEIT account to see your match history and stats.</p>
          <button className="btn btn-primary" onClick={onOpenSettings}>Configure FACEIT</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Performance</h1>
            <p className="subtitle">
              {player?.nickname || config.nickname}
              {elo ? ` — ELO ${elo}` : ''}
              {skillLevel ? ` (Level ${skillLevel})` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={refresh} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button className="btn btn-sm" onClick={onOpenSettings}>Settings</button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius)', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Lifetime Stats Cards */}
      {lifetime && (
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Matches', value: lifetime['Matches'] },
            { label: 'Win Rate', value: lifetime['Win Rate %'] ? lifetime['Win Rate %'] + '%' : null },
            { label: 'K/D Ratio', value: lifetime['Average K/D Ratio'] },
            { label: 'Headshot %', value: lifetime['Average Headshots %'] ? lifetime['Average Headshots %'] + '%' : null },
            { label: 'Longest Streak', value: lifetime['Longest Win Streak'] },
            { label: 'Recent Results', value: lifetime['Recent Results']?.slice(0, 8)?.join('') },
          ].filter(s => s.value).map((s) => (
            <div key={s.label} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 18px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 20, color: 'var(--text)' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Match History */}
      <div className="task-group-header" style={{ marginBottom: 8 }}>
        <span>Recent Matches</span>
        <span className="task-group-count">{matches.length}</span>
      </div>

      {matches.length === 0 && !loading && (
        <div className="empty-state">No matches found.</div>
      )}

      {loading && matches.length === 0 && (
        <div className="empty-state">Fetching your matches...</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {matches.map((match) => {
          const won = didWin(match);
          const myStats = findMyStats(match.match_id);
          const score = match.results?.score;
          const scoreStr = score ? `${score.faction1}–${score.faction2}` : '';

          return (
            <div
              key={match.match_id}
              className="task-row"
              style={{ borderLeft: `3px solid ${won ? 'var(--success)' : 'var(--danger)'}` }}
            >
              <span style={{
                fontSize: 12,
                fontWeight: 500,
                width: 32,
                textAlign: 'center',
                padding: '2px 0',
                borderRadius: 'var(--radius-sm)',
                background: won ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: won ? 'var(--success)' : 'var(--danger)',
                flexShrink: 0,
              }}>
                {won ? 'W' : 'L'}
              </span>

              <span className="task-title" style={{ textDecoration: 'none' }}>
                {match.competition_name || match.game_mode || 'Match'}
              </span>

              {scoreStr && (
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', minWidth: 36, textAlign: 'center' }}>
                  {scoreStr}
                </span>
              )}

              {myStats && (
                <span style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-2)' }}>
                  <span title="Kills/Deaths">
                    <strong style={{ color: 'var(--text)' }}>{myStats['Kills']}</strong>/{myStats['Deaths']}
                  </span>
                  <span title="K/D">
                    {myStats['K/D Ratio']}
                  </span>
                  <span title="Headshot %" style={{ color: 'var(--text-3)' }}>
                    {myStats['Headshots %']}% HS
                  </span>
                </span>
              )}

              <span className="task-due">{formatTime(match.started_at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
