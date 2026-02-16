import { useState, useEffect } from 'react';
import { IconX } from './Icons';
import { FaceitAPI } from '../faceit';

export default function MatchDetailModal({ open, match, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const config = FaceitAPI.getConfig();
  const playerId = config.playerId;

  useEffect(() => {
    if (!open || !match) return;
    setDetail(null);
    setLoading(true);
    setError('');

    FaceitAPI.getMatchStats(match.match_id)
      .then((data) => setDetail(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, match]);

  if (!open || !match) return null;

  const score = match.results?.score;
  const winner = match.results?.winner;
  const startedAt = match.started_at
    ? new Date(match.started_at * 1000).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  // Determine which faction the player is on
  const isPlayerFaction1 = match.teams?.faction1?.players?.some(
    (p) => p.player_id === playerId
  );
  const playerFaction = isPlayerFaction1 ? 'faction1' : 'faction2';
  const playerWon = winner === playerFaction;

  // Extract round data from detail
  const round = detail?.rounds?.[0];
  const mapName = round?.round_stats?.Map || match.game_mode || '';
  const roundScore = round?.round_stats?.Score;

  // Build team data from the round detail (has full player stats)
  const teams = round?.teams || [];

  // Sort players in each team by kills descending
  const sortedTeams = teams.map((team) => ({
    ...team,
    players: [...(team.players || [])].sort(
      (a, b) =>
        parseInt(b.player_stats?.Kills || 0) -
        parseInt(a.player_stats?.Kills || 0)
    ),
  }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card match-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Match Details</h2>
          <button className="modal-close" onClick={onClose}>
            <IconX />
          </button>
        </div>

        <div className="modal-body">
          {/* Match Summary */}
          <div className="match-summary">
            <div className="match-summary-left">
              <span className="match-competition">
                {match.competition_name || 'Match'}
              </span>
              <span className="match-meta">{startedAt}</span>
              {mapName && <span className="match-meta">Map: {mapName}</span>}
            </div>
            <div className="match-summary-right">
              <span
                className={`match-result-badge ${playerWon ? 'win' : 'loss'}`}
              >
                {playerWon ? 'VICTORY' : 'DEFEAT'}
              </span>
              <span className="match-final-score">
                {score
                  ? `${score.faction1} – ${score.faction2}`
                  : roundScore || ''}
              </span>
            </div>
          </div>

          {loading && (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              Loading match details...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius)',
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {/* Team Tables */}
          {sortedTeams.map((team, ti) => {
            const teamName =
              team.team_stats?.Team ||
              (ti === 0 ? 'Team 1' : 'Team 2');
            const teamWon = team.team_stats?.['Team Win'] === '1';
            const teamScore =
              team.team_stats?.['Final Score'] ||
              team.team_stats?.['Second Half Score'];

            return (
              <div key={ti} className="match-team-section">
                <div className="match-team-header">
                  <span
                    className={`match-team-name ${teamWon ? 'winner' : ''}`}
                  >
                    {teamName}
                  </span>
                  {teamWon && (
                    <span className="match-team-winner-tag">Winner</span>
                  )}
                </div>

                <div className="match-scoreboard">
                  <div className="match-scoreboard-header">
                    <span className="sb-player">Player</span>
                    <span className="sb-stat">K</span>
                    <span className="sb-stat">A</span>
                    <span className="sb-stat">D</span>
                    <span className="sb-stat">K/D</span>
                    <span className="sb-stat">K/R</span>
                    <span className="sb-stat">HS%</span>
                    <span className="sb-stat">MVP</span>
                  </div>

                  {(team.players || []).map((p) => {
                    const s = p.player_stats || {};
                    const isMe = p.player_id === playerId;
                    return (
                      <div
                        key={p.player_id}
                        className={`match-scoreboard-row ${isMe ? 'highlight' : ''}`}
                      >
                        <span className="sb-player">
                          {p.nickname || 'Unknown'}
                        </span>
                        <span className="sb-stat sb-kills">
                          {s.Kills ?? '-'}
                        </span>
                        <span className="sb-stat">{s.Assists ?? '-'}</span>
                        <span className="sb-stat">{s.Deaths ?? '-'}</span>
                        <span className="sb-stat">{s['K/D Ratio'] ?? '-'}</span>
                        <span className="sb-stat">{s['K/R Ratio'] ?? '-'}</span>
                        <span className="sb-stat">
                          {s['Headshots %'] ? s['Headshots %'] + '%' : '-'}
                        </span>
                        <span className="sb-stat">{s.MVPs ?? '-'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
