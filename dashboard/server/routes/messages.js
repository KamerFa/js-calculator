import { Router } from 'express';
import pool, { uid } from '../db.js';
import { notify, getUsername } from '../notify.js';

const router = Router();

// ── GET messages for a project ──────────────────────────────
router.get('/:projectId', async (req, res) => {
  // Check membership
  const { rows: memberCheck } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [req.params.projectId, req.userId]
  );
  if (memberCheck.length === 0) {
    return res.status(403).json({ error: 'Not a member of this project' });
  }

  const limit = Math.min(parseInt(req.query.limit) || 100, 200);
  const before = req.query.before || null;

  let query, params;
  if (before) {
    query = `SELECT pm.*, u.username, u.avatar_url
             FROM project_messages pm
             JOIN users u ON u.id = pm.user_id
             WHERE pm.project_id = $1 AND pm.created_at < $2
             ORDER BY pm.created_at DESC
             LIMIT $3`;
    params = [req.params.projectId, before, limit];
  } else {
    query = `SELECT pm.*, u.username, u.avatar_url
             FROM project_messages pm
             JOIN users u ON u.id = pm.user_id
             WHERE pm.project_id = $1
             ORDER BY pm.created_at DESC
             LIMIT $2`;
    params = [req.params.projectId, limit];
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
       WHERE mr.message_id = ANY($1) AND mr.message_type = 'project'`,
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
      `SELECT pm.id, pm.body, pm.user_id, u.username
       FROM project_messages pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.id = ANY($1)`,
      [replyIds]
    );
    for (const r of replyRows) {
      replyMap[r.id] = { id: r.id, body: r.body.slice(0, 100), userId: r.user_id, username: r.username };
    }
  }

  // Reply counts per message
  let replyCountMap = {};
  if (msgIds.length > 0) {
    const { rows: replyCounts } = await pool.query(
      `SELECT reply_to_id, COUNT(*)::int AS count FROM project_messages
       WHERE reply_to_id = ANY($1) GROUP BY reply_to_id`,
      [msgIds]
    );
    for (const r of replyCounts) replyCountMap[r.reply_to_id] = r.count;
  }

  res.json(mainFeedRows.reverse().map((r) => ({
    id: r.id,
    body: r.body,
    userId: r.user_id,
    username: r.username,
    avatarUrl: r.avatar_url || null,
    mentions: r.mentions || [],
    createdAt: r.created_at,
    reactions: reactMap[r.id] || {},
    replyToId: r.reply_to_id || null,
    replyTo: r.reply_to_id
      ? (replyMap[r.reply_to_id] || { id: r.reply_to_id, body: '[deleted]', username: '' })
      : null,
    replyCount: replyCountMap[r.id] || 0,
  })));
});

// ── POST toggle reaction on a project message ─────────────
router.post('/:projectId/react/:messageId', async (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji required' });

  // Check membership
  const { rows: memberCheck } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [req.params.projectId, req.userId]
  );
  if (memberCheck.length === 0) return res.status(403).json({ error: 'Not a member' });

  // Verify message exists in this project
  const { rows: msg } = await pool.query(
    'SELECT user_id FROM project_messages WHERE id = $1 AND project_id = $2',
    [req.params.messageId, req.params.projectId]
  );
  if (msg.length === 0) return res.status(404).json({ error: 'Message not found' });

  // Toggle
  const { rows: existing } = await pool.query(
    `SELECT id FROM message_reactions
     WHERE message_id = $1 AND message_type = 'project' AND user_id = $2 AND emoji = $3`,
    [req.params.messageId, req.userId, emoji]
  );
  if (existing.length > 0) {
    await pool.query('DELETE FROM message_reactions WHERE id = $1', [existing[0].id]);
  } else {
    await pool.query(
      `INSERT INTO message_reactions (id, message_id, message_type, user_id, emoji)
       VALUES ($1, $2, 'project', $3, $4)`,
      [uid(), req.params.messageId, req.userId, emoji]
    );
    // Notify message author
    if (msg[0].user_id !== req.userId) {
      const actor = await getUsername(req.userId);
      await notify(msg[0].user_id, req.userId, 'message_reaction',
        `${actor} reacted ${emoji} to your message`, 'project_message', req.params.messageId);
    }
  }
  res.json({ ok: true });
});

// ── GET thread for a project message ────────────────────────
router.get('/:projectId/thread/:parentId', async (req, res) => {
  // Check membership
  const { rows: memberCheck } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [req.params.projectId, req.userId]
  );
  if (memberCheck.length === 0) {
    return res.status(403).json({ error: 'Not a member of this project' });
  }

  // Fetch parent message
  const { rows: parentRows } = await pool.query(
    `SELECT pm.*, u.username, u.avatar_url
     FROM project_messages pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.id = $1 AND pm.project_id = $2`,
    [req.params.parentId, req.params.projectId]
  );
  if (parentRows.length === 0) {
    return res.status(404).json({ error: 'Parent message not found' });
  }

  // Fetch all replies
  const { rows: replies } = await pool.query(
    `SELECT pm.*, u.username, u.avatar_url
     FROM project_messages pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.reply_to_id = $1 AND pm.project_id = $2
     ORDER BY pm.created_at ASC`,
    [req.params.parentId, req.params.projectId]
  );

  // Enrich with reactions
  const allIds = [req.params.parentId, ...replies.map(r => r.id)];
  let reactMap = {};
  if (allIds.length > 0) {
    const { rows: reactionRows } = await pool.query(
      `SELECT mr.message_id, mr.emoji, mr.user_id, u.username
       FROM message_reactions mr
       JOIN users u ON u.id = mr.user_id
       WHERE mr.message_id = ANY($1) AND mr.message_type = 'project'`,
      [allIds]
    );
    for (const r of reactionRows) {
      if (!reactMap[r.message_id]) reactMap[r.message_id] = {};
      if (!reactMap[r.message_id][r.emoji]) reactMap[r.message_id][r.emoji] = [];
      reactMap[r.message_id][r.emoji].push({ userId: r.user_id, username: r.username });
    }
  }

  const mapMsg = (r) => ({
    id: r.id,
    body: r.body,
    userId: r.user_id,
    username: r.username,
    avatarUrl: r.avatar_url || null,
    mentions: r.mentions || [],
    createdAt: r.created_at,
    reactions: reactMap[r.id] || {},
    replyToId: r.reply_to_id || null,
  });

  res.json({
    parent: mapMsg(parentRows[0]),
    replies: replies.map(mapMsg),
  });
});

// ── POST new message ────────────────────────────────────────
router.post('/:projectId', async (req, res) => {
  const { body } = req.body;
  if (!body?.trim() || body.trim().length > 1000) {
    return res.status(400).json({ error: 'Message must be 1-1000 characters' });
  }

  // Check membership
  const { rows: memberCheck } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [req.params.projectId, req.userId]
  );
  if (memberCheck.length === 0) {
    return res.status(403).json({ error: 'Not a member of this project' });
  }

  // Extract @mentions from message body
  const mentionPattern = /@(\w+)/g;
  const mentionedUsernames = [];
  let match;
  while ((match = mentionPattern.exec(body)) !== null) {
    mentionedUsernames.push(match[1].toLowerCase());
  }

  // Resolve mentioned usernames to user IDs
  const mentions = [];
  if (mentionedUsernames.length > 0) {
    const { rows: mentionedUsers } = await pool.query(
      `SELECT id, username FROM users WHERE LOWER(username) = ANY($1)`,
      [mentionedUsernames]
    );
    for (const u of mentionedUsers) {
      mentions.push(u.username);
    }
  }

  const replyToId = req.body.replyToId || null;
  const threadOnly = !!req.body.threadOnly;
  const id = uid();
  await pool.query(
    `INSERT INTO project_messages (id, project_id, user_id, body, mentions, reply_to_id, thread_only)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, req.params.projectId, req.userId, body.trim(), mentions, replyToId, threadOnly]
  );

  // Notify mentioned users
  if (mentions.length > 0) {
    const actor = await getUsername(req.userId);
    const preview = body.trim().slice(0, 60) + (body.trim().length > 60 ? '...' : '');
    const { rows: mentionedUsers } = await pool.query(
      `SELECT id FROM users WHERE LOWER(username) = ANY($1)`,
      [mentions.map((m) => m.toLowerCase())]
    );
    for (const u of mentionedUsers) {
      await notify(u.id, req.userId, 'project_invite',
        `${actor} mentioned you: "${preview}"`, 'project', req.params.projectId);
    }
  }

  // Return the created message
  const { rows } = await pool.query(
    `SELECT pm.*, u.username, u.avatar_url
     FROM project_messages pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.id = $1`,
    [id]
  );
  const r = rows[0];
  res.json({
    id: r.id,
    body: r.body,
    userId: r.user_id,
    username: r.username,
    avatarUrl: r.avatar_url || null,
    mentions: r.mentions || [],
    createdAt: r.created_at,
  });
});

// ── DELETE own message ──────────────────────────────────────
router.delete('/:projectId/:messageId', async (req, res) => {
  await pool.query(
    'DELETE FROM project_messages WHERE id = $1 AND user_id = $2 AND project_id = $3',
    [req.params.messageId, req.userId, req.params.projectId]
  );
  res.json({ ok: true });
});

// ── PUT mark project channel as read ────────────────────────
router.put('/:projectId/read', async (req, res) => {
  const { rows: memberCheck } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [req.params.projectId, req.userId]
  );
  if (memberCheck.length === 0) {
    return res.status(403).json({ error: 'Not a member of this project' });
  }

  await pool.query(
    `INSERT INTO project_message_read_cursors (user_id, project_id, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, project_id) DO UPDATE SET last_read_at = NOW()`,
    [req.userId, req.params.projectId]
  );
  res.json({ ok: true });
});

export default router;
