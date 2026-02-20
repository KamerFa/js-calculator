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

  res.json(rows.reverse().map((r) => ({
    id: r.id,
    body: r.body,
    userId: r.user_id,
    username: r.username,
    avatarUrl: r.avatar_url || null,
    mentions: r.mentions || [],
    createdAt: r.created_at,
  })));
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

  const id = uid();
  await pool.query(
    `INSERT INTO project_messages (id, project_id, user_id, body, mentions)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, req.params.projectId, req.userId, body.trim(), mentions]
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
