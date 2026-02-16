// ============================================================
// FACEIT Data API v4 — Client-side wrapper
// Docs: https://docs.faceit.com/docs/data-api/data/
// ============================================================

const BASE = 'https://open.faceit.com/data/v4';

function getConfig() {
  try {
    return JSON.parse(localStorage.getItem('dash_faceit_config')) || {};
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  localStorage.setItem('dash_faceit_config', JSON.stringify(cfg));
}

async function api(path) {
  const { apiKey } = getConfig();
  if (!apiKey) throw new Error('FACEIT API key not configured');

  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FACEIT API ${res.status}: ${body}`);
  }
  return res.json();
}

/** Look up player by nickname, returns { player_id, nickname, avatar, games, ... } */
async function getPlayer(nickname) {
  return api(`/players?nickname=${encodeURIComponent(nickname)}`);
}

/** Get player match history. game = "cs2" or "csgo". Returns { items: [...] } */
async function getMatchHistory(playerId, game = 'cs2', limit = 20) {
  const to = Math.floor(Date.now() / 1000);
  return api(`/players/${playerId}/history?game=${game}&from=0&to=${to}&offset=0&limit=${limit}`);
}

/** Get lifetime stats for a player + game. Returns { lifetime: {...}, segments: [...] } */
async function getPlayerStats(playerId, game = 'cs2') {
  return api(`/players/${playerId}/stats/${game}`);
}

/** Get detailed stats for a specific match. Returns { rounds: [...] } */
async function getMatchStats(matchId) {
  return api(`/matches/${matchId}/stats`);
}

export const FaceitAPI = {
  getConfig,
  saveConfig,
  getPlayer,
  getMatchHistory,
  getPlayerStats,
  getMatchStats,
};
