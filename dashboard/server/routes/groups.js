import { Router } from 'express';
import pool, { uid } from '../db.js';
import { notify, getUsername } from '../notify.js';

const router = Router();

// ── POST create a group ──────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, color, memberIds } = req.body;
  if (!name?.trim() || name.trim().length > 50) {
    return res.status(400).json({ error: 'Group name must be 1-50 characters' });
  }

  const groupId = uid();
  await pool.query(
    `INSERT INTO group_chats (id, name, color, creator_id) VALUES ($1, $2, $3, $4)`,
    [groupId, name.trim(), color || '#2a5caa', req.userId]
  );

  // Add creator as owner
  await pool.query(
    `INSERT INTO group_members (id, group_id, user_id, role) VALUES ($1, $2, $3, 'owner')`,
    [uid(), groupId, req.userId]
  );

  // Add other members
  if (Array.isArray(memberIds)) {
    for (const memberId of memberIds) {
      if (memberId === req.userId) continue;
      // Verify friendship
      const { rows: fr } = await pool.query(
        `SELECT 1 FROM friendships WHERE
         ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
         AND status = 'accepted'`,
        [req.userId, memberId]
      );
      if (fr.length > 0) {
        await pool.query(
          `INSERT INTO group_members (id, group_id, user_id) VALUES ($1, $2, $3)
           ON CONFLICT (group_id, user_id) DO NOTHING`,
          [uid(), groupId, memberId]
        );
        const actor = await getUsername(req.userId);
        await notify(memberId, req.userId, 'group_invite',
          `${actor} added you to group "${name.trim()}"`, 'group', groupId);
      }
    }
  }

  res.json({ id: groupId, name: name.trim(), color: color || '#2a5caa' });
});

// ── GET group members ────────────────────────────────────────
router.get('/:groupId/members', async (req, res) => {
  const { rows: memberCheck } = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [req.params.groupId, req.userId]
  );
  if (memberCheck.length === 0) return res.status(403).json({ error: 'Not a member' });

  const { rows } = await pool.query(
    `SELECT gm.user_id, u.username, u.avatar_url, gm.role, gm.joined_at
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY gm.joined_at ASC`,
    [req.params.groupId]
  );
  res.json(rows.map(r => ({
    userId: r.user_id,
    username: r.username,
    avatarUrl: r.avatar_url || null,
    role: r.role,
    joinedAt: r.joined_at,
  })));
});

// ── POST add member to group ─────────────────────────────────
router.post('/:groupId/members', async (req, res) => {
  const { userId: newMemberId } = req.body;
  if (!newMemberId) return res.status(400).json({ error: 'userId required' });

  // Check if requester is a member
  const { rows: memberCheck } = await pool.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
    [req.params.groupId, req.userId]
  );
  if (memberCheck.length === 0) return res.status(403).json({ error: 'Not a member' });

  // Verify friendship with new member
  const { rows: fr } = await pool.query(
    `SELECT 1 FROM friendships WHERE
     ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
     AND status = 'accepted'`,
    [req.userId, newMemberId]
  );
  if (fr.length === 0) return res.status(400).json({ error: 'Must be friends to add to group' });

  await pool.query(
    `INSERT INTO group_members (id, group_id, user_id) VALUES ($1, $2, $3)
     ON CONFLICT (group_id, user_id) DO NOTHING`,
    [uid(), req.params.groupId, newMemberId]
  );

  const actor = await getUsername(req.userId);
  const { rows: grp } = await pool.query('SELECT name FROM group_chats WHERE id = $1', [req.params.groupId]);
  await notify(newMemberId, req.userId, 'group_invite',
    `${actor} added you to group "${grp[0]?.name}"`, 'group', req.params.groupId);

  res.json({ ok: true });
});

// ── DELETE remove member / leave group ───────────────────────
router.delete('/:groupId/members/:userId', async (req, res) => {
  const { groupId, userId: targetId } = req.params;

  const { rows: memberCheck } = await pool.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, req.userId]
  );
  if (memberCheck.length === 0) return res.status(403).json({ error: 'Not a member' });

  // Only owner can remove others; anyone can remove themselves
  if (targetId !== req.userId && memberCheck[0].role !== 'owner') {
    return res.status(403).json({ error: 'Only the group owner can remove members' });
  }

  await pool.query(
    'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, targetId]
  );
  res.json({ ok: true });
});

// ── GET messages for a group ─────────────────────────────────
router.get('/:groupId/messages', async (req, res) => {
  const { rows: memberCheck } = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [req.params.groupId, req.userId]
  );
  if (memberCheck.length === 0) return res.status(403).json({ error: 'Not a member' });

  const limit = Math.min(parseInt(req.query.limit) || 100, 200);

  const { rows } = await pool.query(
    `SELECT gm.*, u.username, u.avatar_url
     FROM group_messages gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY gm.created_at DESC
     LIMIT $2`,
    [req.params.groupId, limit]
  );

  // Filter thread-only from main feed
  const mainFeedRows = rows.filter(r => !r.reply_to_id || !r.thread_only);

  // Enrich with reactions
  const msgIds = mainFeedRows.map(r => r.id);
  let reactMap = {};
  if (msgIds.length > 0) {
    const { rows: reactionRows } = await pool.query(
      `SELECT mr.message_id, mr.emoji, mr.user_id, u.username
       FROM message_reactions mr
       JOIN users u ON u.id = mr.user_id
       WHERE mr.message_id = ANY($1) AND mr.message_type = 'group'`,
      [msgIds]
    );
    for (const r of reactionRows) {
      if (!reactMap[r.message_id]) reactMap[r.message_id] = {};
      if (!reactMap[r.message_id][r.emoji]) reactMap[r.message_id][r.emoji] = [];
      reactMap[r.message_id][r.emoji].push({ userId: r.user_id, username: r.username });
    }
  }

  // Reply-to info
  const replyIds = mainFeedRows.filter(r => r.reply_to_id).map(r => r.reply_to_id);
  let replyMap = {};
  if (replyIds.length > 0) {
    const { rows: replyRows } = await pool.query(
      `SELECT gm.id, gm.body, gm.user_id, u.username
       FROM group_messages gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.id = ANY($1)`,
      [replyIds]
    );
    for (const r of replyRows) {
      replyMap[r.id] = { id: r.id, body: r.body.slice(0, 100), userId: r.user_id, username: r.username };
    }
  }

  // Reply counts
  let replyCountMap = {};
  if (msgIds.length > 0) {
    const { rows: replyCounts } = await pool.query(
      `SELECT reply_to_id, COUNT(*)::int AS count FROM group_messages
       WHERE reply_to_id = ANY($1) GROUP BY reply_to_id`,
      [msgIds]
    );
    for (const r of replyCounts) replyCountMap[r.reply_to_id] = r.count;
  }

  // Typing indicators
  const { rows: typingRows } = await pool.query(
    `SELECT u.username FROM typing_indicators ti
     JOIN users u ON u.id = ti.user_id
     WHERE ti.target_type = 'group' AND ti.target_id = $1
       AND ti.user_id != $2
       AND ti.updated_at > NOW() - INTERVAL '4 seconds'`,
    [req.params.groupId, req.userId]
  );

  res.json({
    messages: mainFeedRows.reverse().map(r => ({
      id: r.id,
      body: r.body,
      userId: r.user_id,
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
    typingUsers: typingRows.map(r => r.username),
  });
});

// ── POST react to group message ──────────────────────────────
router.post('/:groupId/react/:messageId', async (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji required' });

  const { rows: memberCheck } = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [req.params.groupId, req.userId]
  );
  if (memberCheck.length === 0) return res.status(403).json({ error: 'Not a member' });

  const { rows: msg } = await pool.query(
    'SELECT user_id FROM group_messages WHERE id = $1 AND group_id = $2',
    [req.params.messageId, req.params.groupId]
  );
  if (msg.length === 0) return res.status(404).json({ error: 'Message not found' });

  const { rows: existing } = await pool.query(
    `SELECT id FROM message_reactions
     WHERE message_id = $1 AND message_type = 'group' AND user_id = $2 AND emoji = $3`,
    [req.params.messageId, req.userId, emoji]
  );
  if (existing.length > 0) {
    await pool.query('DELETE FROM message_reactions WHERE id = $1', [existing[0].id]);
  } else {
    await pool.query(
      `INSERT INTO message_reactions (id, message_id, message_type, user_id, emoji)
       VALUES ($1, $2, 'group', $3, $4)`,
      [uid(), req.params.messageId, req.userId, emoji]
    );
  }
  res.json({ ok: true });
});

// ── GET thread for a group message ───────────────────────────
router.get('/:groupId/thread/:parentId', async (req, res) => {
  const { rows: memberCheck } = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [req.params.groupId, req.userId]
  );
  if (memberCheck.length === 0) return res.status(403).json({ error: 'Not a member' });

  const { rows: parentRows } = await pool.query(
    `SELECT gm.*, u.username, u.avatar_url
     FROM group_messages gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.id = $1 AND gm.group_id = $2`,
    [req.params.parentId, req.params.groupId]
  );
  if (parentRows.length === 0) return res.status(404).json({ error: 'Parent message not found' });

  const { rows: replies } = await pool.query(
    `SELECT gm.*, u.username, u.avatar_url
     FROM group_messages gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.reply_to_id = $1 AND gm.group_id = $2
     ORDER BY gm.created_at ASC`,
    [req.params.parentId, req.params.groupId]
  );

  const allIds = [req.params.parentId, ...replies.map(r => r.id)];
  let reactMap = {};
  if (allIds.length > 0) {
    const { rows: reactionRows } = await pool.query(
      `SELECT mr.message_id, mr.emoji, mr.user_id, u.username
       FROM message_reactions mr
       JOIN users u ON u.id = mr.user_id
       WHERE mr.message_id = ANY($1) AND mr.message_type = 'group'`,
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
    createdAt: r.created_at,
    reactions: reactMap[r.id] || {},
    replyToId: r.reply_to_id || null,
  });

  res.json({ parent: mapMsg(parentRows[0]), replies: replies.map(mapMsg) });
});

// ── POST typing indicator ────────────────────────────────────
router.post('/:groupId/typing', async (req, res) => {
  const { rows: memberCheck } = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [req.params.groupId, req.userId]
  );
  if (memberCheck.length === 0) return res.status(403).json({ error: 'Not a member' });

  await pool.query(
    `INSERT INTO typing_indicators (user_id, target_type, target_id, updated_at)
     VALUES ($1, 'group', $2, NOW())
     ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET updated_at = NOW()`,
    [req.userId, req.params.groupId]
  );
  res.json({ ok: true });
});

// ── POST send a group message ────────────────────────────────
router.post('/:groupId/messages', async (req, res) => {
  const { body } = req.body;
  if (!body?.trim() || body.trim().length > 1000) {
    return res.status(400).json({ error: 'Message must be 1-1000 characters' });
  }

  const { rows: memberCheck } = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [req.params.groupId, req.userId]
  );
  if (memberCheck.length === 0) return res.status(403).json({ error: 'Not a member' });

  const replyToId = req.body.replyToId || null;
  const threadOnly = !!req.body.threadOnly;
  const id = uid();
  await pool.query(
    `INSERT INTO group_messages (id, group_id, user_id, body, reply_to_id, thread_only)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, req.params.groupId, req.userId, body.trim(), replyToId, threadOnly]
  );

  // Notify mentioned users or @chat
  const mentionPattern = /@(\w+)/g;
  const mentionedUsernames = [];
  let match;
  while ((match = mentionPattern.exec(body)) !== null) {
    mentionedUsernames.push(match[1].toLowerCase());
  }

  const actor = await getUsername(req.userId);
  const preview = body.trim().slice(0, 60) + (body.trim().length > 60 ? '...' : '');
  const hasChatMention = mentionedUsernames.includes('chat');

  if (hasChatMention) {
    const { rows: allMembers } = await pool.query(
      `SELECT user_id FROM group_members WHERE group_id = $1 AND user_id != $2`,
      [req.params.groupId, req.userId]
    );
    for (const m of allMembers) {
      await notify(m.user_id, req.userId, 'group_message',
        `${actor} mentioned @chat: "${preview}"`, 'group', req.params.groupId);
    }
  } else if (mentionedUsernames.length > 0) {
    const { rows: mentionedUsers } = await pool.query(
      `SELECT id FROM users WHERE LOWER(username) = ANY($1)`,
      [mentionedUsernames]
    );
    for (const u of mentionedUsers) {
      if (u.id !== req.userId) {
        await notify(u.id, req.userId, 'group_message',
          `${actor} mentioned you: "${preview}"`, 'group', req.params.groupId);
      }
    }
  }

  const { rows } = await pool.query(
    `SELECT gm.*, u.username, u.avatar_url
     FROM group_messages gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.id = $1`,
    [id]
  );
  const r = rows[0];
  res.json({
    id: r.id, body: r.body, userId: r.user_id, username: r.username,
    avatarUrl: r.avatar_url || null, createdAt: r.created_at,
    reactions: {}, replyToId: r.reply_to_id || null, replyCount: 0,
  });
});

// ── DELETE a group message ───────────────────────────────────
router.delete('/:groupId/messages/:messageId', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT user_id FROM group_messages WHERE id = $1 AND group_id = $2',
    [req.params.messageId, req.params.groupId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  if (rows[0].user_id !== req.userId) return res.status(403).json({ error: 'Not your message' });

  await pool.query('DELETE FROM message_reactions WHERE message_id = $1 AND message_type = $2', [req.params.messageId, 'group']);
  await pool.query('DELETE FROM group_messages WHERE id = $1', [req.params.messageId]);
  res.json({ ok: true });
});

// ── PUT mark group as read ───────────────────────────────────
router.put('/:groupId/read', async (req, res) => {
  await pool.query(
    `INSERT INTO group_message_read_cursors (user_id, group_id, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, group_id) DO UPDATE SET last_read_at = NOW()`,
    [req.userId, req.params.groupId]
  );
  res.json({ ok: true });
});

export default router;
