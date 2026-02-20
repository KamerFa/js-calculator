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

  // 3) Group conversations: latest message per group
  const { rows: groupConvs } = await pool.query(`
    WITH my_groups AS (
      SELECT gm.group_id FROM group_members gm WHERE gm.user_id = $1
    ),
    latest_gm AS (
      SELECT DISTINCT ON (mg.group_id)
        mg.group_id,
        msg.id, msg.body, msg.user_id AS sender_id, msg.created_at,
        u.username AS sender_username
      FROM my_groups mg
      JOIN group_messages msg ON msg.group_id = mg.group_id
      JOIN users u ON u.id = msg.user_id
      ORDER BY mg.group_id, msg.created_at DESC
    )
    SELECT lg.*, g.name AS group_name, g.color AS group_color,
      (SELECT COUNT(*) FROM group_messages gm2
       WHERE gm2.group_id = lg.group_id
         AND gm2.created_at > COALESCE(
           (SELECT last_read_at FROM group_message_read_cursors WHERE user_id = $1 AND group_id = lg.group_id),
           '1970-01-01T00:00:00Z'::timestamptz
         )
         AND gm2.user_id != $1
      )::int AS unread_count
    FROM latest_gm lg
    JOIN group_chats g ON g.id = lg.group_id
    ORDER BY lg.created_at DESC
  `, [userId]);

  // Also get groups with no messages yet (newly created)
  const { rows: emptyGroups } = await pool.query(`
    SELECT g.id AS group_id, g.name AS group_name, g.color AS group_color, g.created_at
    FROM group_chats g
    JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
    WHERE NOT EXISTS (SELECT 1 FROM group_messages msg WHERE msg.group_id = g.id)
  `, [userId]);

  // 4) Merge and sort
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

  for (const gc of groupConvs) {
    conversations.push({
      type: 'group',
      groupId: gc.group_id,
      groupName: gc.group_name,
      groupColor: gc.group_color,
      lastMessage: {
        body: gc.body,
        createdAt: gc.created_at,
        username: gc.sender_username,
      },
      unreadCount: gc.unread_count,
    });
  }

  for (const eg of emptyGroups) {
    conversations.push({
      type: 'group',
      groupId: eg.group_id,
      groupName: eg.group_name,
      groupColor: eg.group_color,
      lastMessage: {
        body: '',
        createdAt: eg.created_at,
        username: '',
      },
      unreadCount: 0,
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

  // Filter out thread-only replies from main feed
  const mainFeedRows = rows.filter(r => !r.reply_to_id || !r.thread_only);

  // Enrich with reactions
  const msgIds = mainFeedRows.map(r => r.id);
  let reactMap = {};
  if (msgIds.length > 0) {
    const { rows: reactionRows } = await pool.query(
      `SELECT mr.message_id, mr.emoji, mr.user_id, u.username
       FROM message_reactions mr
       JOIN users u ON u.id = mr.user_id
       WHERE mr.message_id = ANY($1) AND mr.message_type = 'dm'`,
      [msgIds]
    );
    for (const r of reactionRows) {
      if (!reactMap[r.message_id]) reactMap[r.message_id] = {};
      if (!reactMap[r.message_id][r.emoji]) reactMap[r.message_id][r.emoji] = [];
      reactMap[r.message_id][r.emoji].push({ userId: r.user_id, username: r.username });
    }
  }

  // Enrich with reply-to info
  const replyIds = mainFeedRows.filter(r => r.reply_to_id).map(r => r.reply_to_id);
  let replyMap = {};
  if (replyIds.length > 0) {
    const { rows: replyRows } = await pool.query(
      `SELECT dm.id, dm.body, dm.sender_id, u.username
       FROM direct_messages dm
       JOIN users u ON u.id = dm.sender_id
       WHERE dm.id = ANY($1)`,
      [replyIds]
    );
    for (const r of replyRows) {
      replyMap[r.id] = { id: r.id, body: r.body.slice(0, 100), senderId: r.sender_id, username: r.username };
    }
  }

  // Reply counts per message (all replies, not just visible ones)
  let replyCountMap = {};
  if (msgIds.length > 0) {
    const { rows: replyCounts } = await pool.query(
      `SELECT reply_to_id, COUNT(*)::int AS count FROM direct_messages
       WHERE reply_to_id = ANY($1) GROUP BY reply_to_id`,
      [msgIds]
    );
    for (const r of replyCounts) replyCountMap[r.reply_to_id] = r.count;
  }

  // Get other user's read cursor for seen/delivered
  const { rows: cursorRows } = await pool.query(
    `SELECT last_read_at FROM dm_read_cursors WHERE user_id = $1 AND other_user_id = $2`,
    [otherId, userId]
  );
  const otherReadAt = cursorRows[0]?.last_read_at || null;

  // Check if other user is typing
  const { rows: typingRows } = await pool.query(
    `SELECT 1 FROM typing_indicators
     WHERE user_id = $1 AND target_type = 'dm' AND target_id = $2
       AND updated_at > NOW() - INTERVAL '4 seconds'`,
    [otherId, userId]
  );
  const isOtherTyping = typingRows.length > 0;

  res.json({
    messages: mainFeedRows.reverse().map((r) => ({
      id: r.id,
      body: r.body,
      senderId: r.sender_id,
      receiverId: r.receiver_id,
      username: r.username,
      avatarUrl: r.avatar_url || null,
      createdAt: r.created_at,
      reactions: reactMap[r.id] || {},
      replyToId: r.reply_to_id || null,
      replyTo: r.reply_to_id
        ? (replyMap[r.reply_to_id] || { id: r.reply_to_id, body: '[deleted]', username: '' })
        : null,
      replyCount: replyCountMap[r.id] || 0,
    })),
    otherReadAt,
    isOtherTyping,
  });
});

// ── POST typing indicator for DM ─────────────────────────────
router.post('/:userId/typing', async (req, res) => {
  await pool.query(
    `INSERT INTO typing_indicators (user_id, target_type, target_id, updated_at)
     VALUES ($1, 'dm', $2, NOW())
     ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET updated_at = NOW()`,
    [req.userId, req.params.userId]
  );
  res.json({ ok: true });
});

// ── POST send a DM ──────────────────────────────────────────
router.post('/:userId', async (req, res) => {
  const userId = req.userId;
  const otherId = req.params.userId;
  const { body, replyToId, threadOnly } = req.body;

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
    `INSERT INTO direct_messages (id, sender_id, receiver_id, body, reply_to_id, thread_only)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, otherId, body.trim(), replyToId || null, !!threadOnly]
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

// ── POST toggle reaction on a DM ──────────────────────────
router.post('/react/:messageId', async (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji required' });

  // Verify the message exists and user is a participant
  const { rows: msg } = await pool.query(
    'SELECT sender_id, receiver_id FROM direct_messages WHERE id = $1',
    [req.params.messageId]
  );
  if (msg.length === 0) return res.status(404).json({ error: 'Message not found' });
  if (msg[0].sender_id !== req.userId && msg[0].receiver_id !== req.userId) {
    return res.status(403).json({ error: 'Not a participant' });
  }

  // Toggle: if exists remove, otherwise add
  const { rows: existing } = await pool.query(
    `SELECT id FROM message_reactions
     WHERE message_id = $1 AND message_type = 'dm' AND user_id = $2 AND emoji = $3`,
    [req.params.messageId, req.userId, emoji]
  );
  if (existing.length > 0) {
    await pool.query('DELETE FROM message_reactions WHERE id = $1', [existing[0].id]);
  } else {
    await pool.query(
      `INSERT INTO message_reactions (id, message_id, message_type, user_id, emoji)
       VALUES ($1, $2, 'dm', $3, $4)`,
      [uid(), req.params.messageId, req.userId, emoji]
    );
    // Notify the other user
    const otherId = msg[0].sender_id === req.userId ? msg[0].receiver_id : msg[0].sender_id;
    const actor = await getUsername(req.userId);
    await notify(otherId, req.userId, 'message_reaction',
      `${actor} reacted ${emoji} to your message`, 'dm', req.params.messageId);
  }
  res.json({ ok: true });
});

// ── GET thread for a parent DM ───────────────────────────────
router.get('/:userId/thread/:parentId', async (req, res) => {
  const userId = req.userId;
  const otherId = req.params.userId;
  const parentId = req.params.parentId;

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

  // Fetch parent message
  const { rows: parentRows } = await pool.query(
    `SELECT dm.*, u.username, u.avatar_url
     FROM direct_messages dm
     JOIN users u ON u.id = dm.sender_id
     WHERE dm.id = $1`,
    [parentId]
  );
  if (parentRows.length === 0) {
    return res.status(404).json({ error: 'Parent message not found' });
  }

  // Fetch all replies
  const { rows: replies } = await pool.query(
    `SELECT dm.*, u.username, u.avatar_url
     FROM direct_messages dm
     JOIN users u ON u.id = dm.sender_id
     WHERE dm.reply_to_id = $1
     ORDER BY dm.created_at ASC`,
    [parentId]
  );

  // Enrich with reactions
  const allIds = [parentId, ...replies.map(r => r.id)];
  let reactMap = {};
  if (allIds.length > 0) {
    const { rows: reactionRows } = await pool.query(
      `SELECT mr.message_id, mr.emoji, mr.user_id, u.username
       FROM message_reactions mr
       JOIN users u ON u.id = mr.user_id
       WHERE mr.message_id = ANY($1) AND mr.message_type = 'dm'`,
      [allIds]
    );
    for (const r of reactionRows) {
      if (!reactMap[r.message_id]) reactMap[r.message_id] = {};
      if (!reactMap[r.message_id][r.emoji]) reactMap[r.message_id][r.emoji] = [];
      reactMap[r.message_id][r.emoji].push({ userId: r.user_id, username: r.username });
    }
  }

  // Get other user's read cursor
  const { rows: cursorRows } = await pool.query(
    `SELECT last_read_at FROM dm_read_cursors WHERE user_id = $1 AND other_user_id = $2`,
    [otherId, userId]
  );
  const otherReadAt = cursorRows[0]?.last_read_at || null;

  const mapMsg = (r) => ({
    id: r.id,
    body: r.body,
    senderId: r.sender_id,
    receiverId: r.receiver_id,
    username: r.username,
    avatarUrl: r.avatar_url || null,
    createdAt: r.created_at,
    reactions: reactMap[r.id] || {},
    replyToId: r.reply_to_id || null,
  });

  res.json({
    parent: mapMsg(parentRows[0]),
    replies: replies.map(mapMsg),
    otherReadAt,
  });
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
