import { Router } from 'express';
import pool, { uid } from '../db.js';
import { notify, getUsername } from '../notify.js';
import { derivePresence } from '../auth.js';

const router = Router();

// ── GET unified conversation list (DMs + project channels) ──
router.get('/conversations', async (req, res) => {
  const userId = req.userId;

  // 1) DM conversations: latest message per conversation partner
  const { rows: dmConvs } = await pool.query(`
    WITH dm_partners AS (
      SELECT DISTINCT
        CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS partner_id
      FROM direct_messages
      WHERE sender_id = $1 OR receiver_id = $1
    ),
    latest_dm AS (
      SELECT DISTINCT ON (dp.partner_id)
        dp.partner_id,
        dm.id, dm.body, dm.sender_id, dm.created_at
      FROM dm_partners dp
      JOIN direct_messages dm ON (
        (dm.sender_id = $1 AND dm.receiver_id = dp.partner_id) OR
        (dm.sender_id = dp.partner_id AND dm.receiver_id = $1)
      )
      ORDER BY dp.partner_id, dm.created_at DESC
    )
    SELECT ld.*, u.username, u.avatar_url, u.presence, u.last_active_at, u.show_online_status,
      u.status_emoji, u.status_text,
      COALESCE(rc.last_read_at, '1970-01-01T00:00:00Z'::timestamptz) AS last_read_at,
      (SELECT COUNT(*) FROM direct_messages dm2
       WHERE ((dm2.sender_id = ld.partner_id AND dm2.receiver_id = $1))
         AND dm2.created_at > COALESCE(rc.last_read_at, '1970-01-01T00:00:00Z'::timestamptz)
      )::int AS unread_count
    FROM latest_dm ld
    JOIN users u ON u.id = ld.partner_id
    LEFT JOIN dm_read_cursors rc ON rc.user_id = $1 AND rc.other_user_id = ld.partner_id
    ORDER BY ld.created_at DESC
  `, [userId]);

  // 2) Project channel conversations: latest message per shared project
  const { rows: projConvs } = await pool.query(`
    WITH my_projects AS (
      SELECT pm.project_id FROM project_members pm WHERE pm.user_id = $1
    ),
    latest_pm AS (
      SELECT DISTINCT ON (mp.project_id)
        mp.project_id,
        msg.id, msg.body, msg.user_id AS sender_id, msg.created_at,
        u.username AS sender_username
      FROM my_projects mp
      JOIN project_messages msg ON msg.project_id = mp.project_id
      JOIN users u ON u.id = msg.user_id
      ORDER BY mp.project_id, msg.created_at DESC
    )
    SELECT lp.*, p.name AS project_name, p.color AS project_color,
      COALESCE(prc.last_read_at, '1970-01-01T00:00:00Z'::timestamptz) AS last_read_at,
      (SELECT COUNT(*) FROM project_messages pm2
       WHERE pm2.project_id = lp.project_id
         AND pm2.created_at > COALESCE(prc.last_read_at, '1970-01-01T00:00:00Z'::timestamptz)
         AND pm2.user_id != $1
      )::int AS unread_count
    FROM latest_pm lp
    JOIN projects p ON p.id = lp.project_id
    LEFT JOIN project_message_read_cursors prc ON prc.user_id = $1 AND prc.project_id = lp.project_id
    ORDER BY lp.created_at DESC
  `, [userId]);

  // 3) Merge and sort
  const conversations = [];

  for (const dm of dmConvs) {
    conversations.push({
      type: 'dm',
      userId: dm.partner_id,
      username: dm.username,
      avatarUrl: dm.avatar_url || null,
      presence: derivePresence(dm),
      statusEmoji: dm.status_emoji || null,
      statusText: dm.status_text || null,
      lastMessage: {
        body: dm.body,
        createdAt: dm.created_at,
        senderId: dm.sender_id,
      },
      unreadCount: dm.unread_count,
    });
  }

  for (const pc of projConvs) {
    conversations.push({
      type: 'project',
      projectId: pc.project_id,
      projectName: pc.project_name,
      projectColor: pc.project_color,
      lastMessage: {
        body: pc.body,
        createdAt: pc.created_at,
        username: pc.sender_username,
      },
      unreadCount: pc.unread_count,
    });
  }

  // Sort by most recent message
  conversations.sort((a, b) =>
    new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
  );

  res.json(conversations);
});

// ── GET total unread count (for nav badge) ──────────────────
router.get('/unread-total', async (req, res) => {
  const userId = req.userId;

  // Unread DMs
  const { rows: [dmRow] } = await pool.query(`
    SELECT COALESCE(SUM(cnt), 0)::int AS total FROM (
      SELECT COUNT(*) AS cnt
      FROM direct_messages dm
      WHERE dm.receiver_id = $1
        AND dm.created_at > COALESCE(
          (SELECT last_read_at FROM dm_read_cursors WHERE user_id = $1 AND other_user_id = dm.sender_id),
          '1970-01-01T00:00:00Z'::timestamptz
        )
      GROUP BY dm.sender_id
    ) sub
  `, [userId]);

  // Unread project messages
  const { rows: [projRow] } = await pool.query(`
    SELECT COALESCE(SUM(cnt), 0)::int AS total FROM (
      SELECT COUNT(*) AS cnt
      FROM project_messages pm
      JOIN project_members mem ON mem.project_id = pm.project_id AND mem.user_id = $1
      WHERE pm.user_id != $1
        AND pm.created_at > COALESCE(
          (SELECT last_read_at FROM project_message_read_cursors WHERE user_id = $1 AND project_id = pm.project_id),
          '1970-01-01T00:00:00Z'::timestamptz
        )
      GROUP BY pm.project_id
    ) sub
  `, [userId]);

  res.json({ total: (dmRow?.total || 0) + (projRow?.total || 0) });
});

// ── GET DM history with a user ──────────────────────────────
router.get('/:userId', async (req, res) => {
  const userId = req.userId;
  const otherId = req.params.userId;

  // Check friendship
  const { rows: fr } = await pool.query(
    `SELECT status FROM friendships WHERE
     ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
     AND status = 'accepted'`,
    [userId, otherId]
  );
  if (fr.length === 0) {
    return res.status(403).json({ error: 'Must be friends to view messages' });
  }

  const limit = Math.min(parseInt(req.query.limit) || 100, 200);
  const before = req.query.before || null;

  let query, params;
  if (before) {
    query = `SELECT dm.*, u.username, u.avatar_url
             FROM direct_messages dm
             JOIN users u ON u.id = dm.sender_id
             WHERE LEAST(dm.sender_id, dm.receiver_id) = LEAST($1, $2)
               AND GREATEST(dm.sender_id, dm.receiver_id) = GREATEST($1, $2)
               AND dm.created_at < $3
             ORDER BY dm.created_at DESC
             LIMIT $4`;
    params = [userId, otherId, before, limit];
  } else {
    query = `SELECT dm.*, u.username, u.avatar_url
             FROM direct_messages dm
             JOIN users u ON u.id = dm.sender_id
             WHERE LEAST(dm.sender_id, dm.receiver_id) = LEAST($1, $2)
               AND GREATEST(dm.sender_id, dm.receiver_id) = GREATEST($1, $2)
             ORDER BY dm.created_at DESC
             LIMIT $3`;
    params = [userId, otherId, limit];
  }

  const { rows } = await pool.query(query, params);

  res.json(rows.reverse().map((r) => ({
    id: r.id,
    body: r.body,
    senderId: r.sender_id,
    receiverId: r.receiver_id,
    username: r.username,
    avatarUrl: r.avatar_url || null,
    createdAt: r.created_at,
  })));
});

// ── POST send a DM ──────────────────────────────────────────
router.post('/:userId', async (req, res) => {
  const userId = req.userId;
  const otherId = req.params.userId;
  const { body } = req.body;

  if (!body?.trim() || body.trim().length > 2000) {
    return res.status(400).json({ error: 'Message must be 1-2000 characters' });
  }

  if (userId === otherId) {
    return res.status(400).json({ error: 'Cannot message yourself' });
  }

  // Check friendship
  const { rows: fr } = await pool.query(
    `SELECT status FROM friendships WHERE
     ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
     AND status = 'accepted'`,
    [userId, otherId]
  );
  if (fr.length === 0) {
    return res.status(403).json({ error: 'Must be friends to send messages' });
  }

  const id = uid();
  await pool.query(
    `INSERT INTO direct_messages (id, sender_id, receiver_id, body)
     VALUES ($1, $2, $3, $4)`,
    [id, userId, otherId, body.trim()]
  );

  // Update sender's read cursor (they've read up to now)
  await pool.query(
    `INSERT INTO dm_read_cursors (user_id, other_user_id, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, other_user_id) DO UPDATE SET last_read_at = NOW()`,
    [userId, otherId]
  );

  // Notify receiver
  const actor = await getUsername(userId);
  const preview = body.trim().slice(0, 60) + (body.trim().length > 60 ? '...' : '');
  await notify(otherId, userId, 'direct_message',
    `${actor}: "${preview}"`, 'dm', userId);

  const { rows } = await pool.query(
    `SELECT dm.*, u.username, u.avatar_url
     FROM direct_messages dm
     JOIN users u ON u.id = dm.sender_id
     WHERE dm.id = $1`,
    [id]
  );
  const r = rows[0];
  res.json({
    id: r.id,
    body: r.body,
    senderId: r.sender_id,
    receiverId: r.receiver_id,
    username: r.username,
    avatarUrl: r.avatar_url || null,
    createdAt: r.created_at,
  });
});

// ── PUT mark DM conversation as read ────────────────────────
router.put('/:userId/read', async (req, res) => {
  await pool.query(
    `INSERT INTO dm_read_cursors (user_id, other_user_id, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, other_user_id) DO UPDATE SET last_read_at = NOW()`,
    [req.userId, req.params.userId]
  );
  res.json({ ok: true });
});

// ── DELETE own DM ────────────────────────────────────────────
router.delete('/:messageId', async (req, res) => {
  await pool.query(
    'DELETE FROM direct_messages WHERE id = $1 AND sender_id = $2',
    [req.params.messageId, req.userId]
  );
  res.json({ ok: true });
});

export default router;
