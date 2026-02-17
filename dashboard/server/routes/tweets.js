import { Router } from 'express';
import pool, { uid } from '../db.js';
import { notify, getUsername } from '../notify.js';

const router = Router();

// ── Helper: enrich tweets with reactions, comments, avatar ──
async function enrichTweets(rows) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  // Reactions grouped per tweet+emoji
  const { rows: reactionRows } = await pool.query(
    `SELECT tr.tweet_id, tr.emoji, tr.user_id, u.username
     FROM tweet_reactions tr
     JOIN users u ON u.id = tr.user_id
     WHERE tr.tweet_id = ANY($1)`,
    [ids]
  );

  // Comments with usernames + avatars
  const { rows: commentRows } = await pool.query(
    `SELECT tc.*, u.username, u.avatar_url
     FROM tweet_comments tc
     JOIN users u ON u.id = tc.user_id
     WHERE tc.tweet_id = ANY($1)
     ORDER BY tc.created_at ASC`,
    [ids]
  );

  // Build per-tweet maps
  const reactMap = {};
  for (const r of reactionRows) {
    if (!reactMap[r.tweet_id]) reactMap[r.tweet_id] = {};
    if (!reactMap[r.tweet_id][r.emoji]) reactMap[r.tweet_id][r.emoji] = [];
    reactMap[r.tweet_id][r.emoji].push({ userId: r.user_id, username: r.username });
  }

  const commentMap = {};
  for (const c of commentRows) {
    if (!commentMap[c.tweet_id]) commentMap[c.tweet_id] = [];
    commentMap[c.tweet_id].push({
      id: c.id, body: c.body, userId: c.user_id,
      username: c.username, avatarUrl: c.avatar_url,
      createdAt: c.created_at,
    });
  }

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    username: r.username,
    avatarUrl: r.avatar_url || null,
    userId: r.user_id,
    createdAt: r.created_at,
    reactions: reactMap[r.id] || {},
    comments: commentMap[r.id] || [],
  }));
}

// ── GET community feed (all tweets, newest first) ─────────
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.*, u.username, u.avatar_url
     FROM tweets t
     JOIN users u ON u.id = t.user_id
     ORDER BY t.created_at DESC
     LIMIT 200`
  );
  res.json(await enrichTweets(rows));
});

// ── POST new tweet ────────────────────────────────────────
router.post('/', async (req, res) => {
  const { body } = req.body;
  if (!body?.trim() || body.trim().length > 280) {
    return res.status(400).json({ error: 'Tweet must be 1-280 characters' });
  }
  const id = uid();
  await pool.query(
    'INSERT INTO tweets (id, user_id, body) VALUES ($1, $2, $3)',
    [id, req.userId, body.trim()]
  );
  const { rows } = await pool.query(
    `SELECT t.*, u.username, u.avatar_url FROM tweets t JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
    [id]
  );
  const enriched = await enrichTweets(rows);
  res.json(enriched[0]);
});

// ── PUT edit own tweet ────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { body } = req.body;
  if (!body?.trim() || body.trim().length > 280) {
    return res.status(400).json({ error: 'Tweet must be 1-280 characters' });
  }
  await pool.query(
    'UPDATE tweets SET body = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
    [body.trim(), req.params.id, req.userId]
  );
  const { rows } = await pool.query(
    `SELECT t.*, u.username, u.avatar_url FROM tweets t JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
    [req.params.id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Tweet not found or not authorized' });
  }
  const enriched = await enrichTweets(rows);
  res.json(enriched[0]);
});

// ── DELETE own tweet ──────────────────────────────────────
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM tweets WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
});

// ── POST toggle reaction ─────────────────────────────────
router.post('/:id/react', async (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji required' });

  // Toggle: if exists remove, otherwise add
  const { rows: existing } = await pool.query(
    'SELECT id FROM tweet_reactions WHERE tweet_id = $1 AND user_id = $2 AND emoji = $3',
    [req.params.id, req.userId, emoji]
  );
  if (existing.length > 0) {
    await pool.query('DELETE FROM tweet_reactions WHERE id = $1', [existing[0].id]);
  } else {
    await pool.query(
      'INSERT INTO tweet_reactions (id, tweet_id, user_id, emoji) VALUES ($1, $2, $3, $4)',
      [uid(), req.params.id, req.userId, emoji]
    );

    // Notify tweet owner
    const { rows: tweet } = await pool.query('SELECT user_id FROM tweets WHERE id = $1', [req.params.id]);
    if (tweet[0]) {
      const actor = await getUsername(req.userId);
      await notify(tweet[0].user_id, req.userId, 'tweet_reaction',
        `${actor} reacted ${emoji} to your tweet`, 'tweet', req.params.id);
    }
  }
  res.json({ ok: true });
});

// ── POST add comment ──────────────────────────────────────
router.post('/:id/comments', async (req, res) => {
  const { body } = req.body;
  if (!body?.trim() || body.trim().length > 500) {
    return res.status(400).json({ error: 'Comment must be 1-500 characters' });
  }
  const id = uid();
  await pool.query(
    'INSERT INTO tweet_comments (id, tweet_id, user_id, body) VALUES ($1, $2, $3, $4)',
    [id, req.params.id, req.userId, body.trim()]
  );

  // Notify tweet owner
  const { rows: tweet } = await pool.query('SELECT user_id FROM tweets WHERE id = $1', [req.params.id]);
  if (tweet[0]) {
    const actor = await getUsername(req.userId);
    const preview = body.trim().slice(0, 60) + (body.trim().length > 60 ? '...' : '');
    await notify(tweet[0].user_id, req.userId, 'tweet_comment',
      `${actor} commented: "${preview}"`, 'tweet', req.params.id);
  }

  const { rows } = await pool.query(
    `SELECT tc.*, u.username, u.avatar_url FROM tweet_comments tc
     JOIN users u ON u.id = tc.user_id WHERE tc.id = $1`,
    [id]
  );
  const c = rows[0];
  res.json({
    id: c.id, body: c.body, userId: c.user_id,
    username: c.username, avatarUrl: c.avatar_url,
    createdAt: c.created_at,
  });
});

// ── DELETE own comment ────────────────────────────────────
router.delete('/comments/:id', async (req, res) => {
  await pool.query('DELETE FROM tweet_comments WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
});

export default router;
