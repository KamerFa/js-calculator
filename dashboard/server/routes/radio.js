import { Router } from 'express';
import pool, { uid } from '../db.js';
import { derivePresence } from '../auth.js';

const router = Router();

// GET /api/radio/reports — get all station report counts + user's own reports
router.get('/reports', async (req, res) => {
  const { rows: counts } = await pool.query(
    `SELECT station_id, COUNT(*)::int as count FROM station_reports GROUP BY station_id`
  );
  const { rows: myReports } = await pool.query(
    `SELECT station_id FROM station_reports WHERE user_id = $1`,
    [req.userId]
  );

  const reportCounts = {};
  for (const r of counts) reportCounts[r.station_id] = r.count;

  res.json({
    counts: reportCounts,
    myReports: myReports.map((r) => r.station_id),
  });
});

// POST /api/radio/report/:stationId — toggle report on a station
router.post('/report/:stationId', async (req, res) => {
  const { stationId } = req.params;

  // Check if already reported
  const { rows: existing } = await pool.query(
    `SELECT id FROM station_reports WHERE station_id = $1 AND user_id = $2`,
    [stationId, req.userId]
  );

  if (existing.length > 0) {
    // Unreport
    await pool.query(`DELETE FROM station_reports WHERE id = $1`, [existing[0].id]);
  } else {
    // Report
    await pool.query(
      `INSERT INTO station_reports (id, station_id, user_id) VALUES ($1, $2, $3)`,
      [uid(), stationId, req.userId]
    );
  }

  // Return updated count
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int as count FROM station_reports WHERE station_id = $1`,
    [stationId]
  );

  res.json({
    stationId,
    reported: existing.length === 0,
    count: countRows[0].count,
  });
});

// PUT /api/radio/listening — update what station the user is listening to
router.put('/listening', async (req, res) => {
  const { stationId } = req.body;
  if (!stationId) {
    // Clear listening status
    await pool.query('DELETE FROM radio_listeners WHERE user_id = $1', [req.userId]);
    return res.json({ ok: true });
  }
  await pool.query(
    `INSERT INTO radio_listeners (user_id, station_id, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET station_id = $2, updated_at = NOW()`,
    [req.userId, stationId]
  );
  res.json({ ok: true });
});

// DELETE /api/radio/listening — stop listening
router.delete('/listening', async (req, res) => {
  await pool.query('DELETE FROM radio_listeners WHERE user_id = $1', [req.userId]);
  res.json({ ok: true });
});

// GET /api/radio/listeners — who's listening right now (last 5 minutes)
router.get('/listeners', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT rl.station_id, rl.updated_at,
            u.id AS user_id, u.username, u.avatar_url,
            u.status_emoji, u.status_text, u.presence,
            u.show_online_status, u.last_active_at
     FROM radio_listeners rl
     JOIN users u ON u.id = rl.user_id
     WHERE rl.updated_at > NOW() - INTERVAL '5 minutes'
       AND rl.user_id != $1
     ORDER BY rl.updated_at DESC`,
    [req.userId]
  );

  // Get user's accepted friends
  const { rows: friends } = await pool.query(
    `SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END AS fid
     FROM friendships
     WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`,
    [req.userId]
  );
  const friendIds = new Set(friends.map((f) => f.fid));

  const others = [];
  const ahbabi = [];
  for (const r of rows) {
    const listener = {
      userId: r.user_id,
      username: r.username,
      avatarUrl: r.avatar_url,
      statusEmoji: r.status_emoji,
      statusText: r.status_text,
      presence: derivePresence(r),
      stationId: r.station_id,
    };
    if (friendIds.has(r.user_id)) {
      ahbabi.push(listener);
    } else {
      others.push(listener);
    }
  }

  res.json({ others, ahbabi });
});

export default router;
