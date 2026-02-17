import { Router } from 'express';
import pool, { uid } from '../db.js';

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

export default router;
