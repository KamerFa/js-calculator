import { Router } from 'express';
import pool, { uid } from '../db.js';
import { notify, getUsername } from '../notify.js';

const router = Router();

// ── GET own profile ──────────────────────────────────────────
router.get('/me', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, username, bio, avatar_url, music_service, music_username, show_projects_on_profile, nickname, created_at
     FROM users WHERE id = $1`,
    [req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  const u = rows[0];
  res.json({
    id: u.id, username: u.username, bio: u.bio || '',
    avatarUrl: u.avatar_url, musicService: u.music_service,
    musicUsername: u.music_username, createdAt: u.created_at,
    showProjectsOnProfile: u.show_projects_on_profile,
    nickname: u.nickname || null,
  });
});

// ── GET public profile by username ───────────────────────────
router.get('/user/:username', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, username, bio, avatar_url, music_service, music_username, show_projects_on_profile, nickname, created_at
     FROM users WHERE LOWER(username) = LOWER($1)`,
    [req.params.username]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  const u = rows[0];

  // Get viewer's private nickname for this user
  let myNickname = null;
  if (u.id !== req.userId) {
    const { rows: nn } = await pool.query(
      'SELECT nickname FROM user_nicknames WHERE user_id = $1 AND target_user_id = $2',
      [req.userId, u.id]
    );
    myNickname = nn[0]?.nickname || null;
  }

  // Check friendship status
  const { rows: fr } = await pool.query(
    `SELECT * FROM friendships WHERE
     (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [req.userId, u.id]
  );
  let friendStatus = null;
  if (fr[0]) {
    if (fr[0].status === 'accepted') friendStatus = 'friends';
    else if (fr[0].user_id === req.userId) friendStatus = 'pending_sent';
    else friendStatus = 'pending_received';
  }

  res.json({
    id: u.id, username: u.username, bio: u.bio || '',
    avatarUrl: u.avatar_url, musicService: u.music_service,
    musicUsername: u.music_username, createdAt: u.created_at,
    showProjectsOnProfile: u.show_projects_on_profile,
    nickname: u.nickname || null,
    myNickname,
    friendStatus,
  });
});

// ── GET user's public projects (for profile page) ────────────
router.get('/user/:username/projects', async (req, res) => {
  // Find the target user
  const { rows: userRows } = await pool.query(
    `SELECT id, show_projects_on_profile FROM users WHERE LOWER(username) = LOWER($1)`,
    [req.params.username]
  );
  if (!userRows[0]) return res.status(404).json({ error: 'User not found' });

  const targetUser = userRows[0];

  // If user disabled project visibility, return empty (unless viewing own profile)
  if (!targetUser.show_projects_on_profile && targetUser.id !== req.userId) {
    return res.json([]);
  }

  // Only return projects that are TRULY public (is_public = true set by owner),
  // not private projects the user was merely invited to.
  // Also filter: user must be a member AND project must be explicitly public.
  const { rows } = await pool.query(
    `SELECT p.*,
            u.username AS owner_name,
            (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id) AS member_count,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
     JOIN users u ON u.id = p.user_id
     WHERE p.is_public = true
     ORDER BY p.created_at DESC`,
    [targetUser.id]
  );

  // Check if current (viewing) user is a member of each project
  const { rows: myMemberships } = await pool.query(
    `SELECT project_id FROM project_members WHERE user_id = $1`,
    [req.userId]
  );
  const mySet = new Set(myMemberships.map((m) => m.project_id));

  res.json(rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    isGlobal: r.is_global,
    ownerName: r.owner_name,
    memberCount: parseInt(r.member_count),
    taskCount: parseInt(r.task_count),
    doneCount: parseInt(r.done_count),
    isMember: mySet.has(r.id),
  })));
});

// ── PUT update profile ───────────────────────────────────────
router.put('/me', async (req, res) => {
  const { bio, musicService, musicUsername, avatarUrl, showProjectsOnProfile, nickname } = req.body;
  const fields = [
    'bio = $1', 'music_service = $2', 'music_username = $3'
  ];
  const values = [
    (bio || '').slice(0, 300),
    musicService || null,
    musicUsername || null,
  ];

  if (avatarUrl !== undefined) {
    fields.push(`avatar_url = $${values.length + 1}`);
    values.push(avatarUrl);
  }

  if (showProjectsOnProfile !== undefined) {
    fields.push(`show_projects_on_profile = $${values.length + 1}`);
    values.push(showProjectsOnProfile ? true : false);
  }

  if (nickname !== undefined) {
    fields.push(`nickname = $${values.length + 1}`);
    values.push(nickname ? nickname.slice(0, 30) : null);
  }

  values.push(req.userId);
  await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}`,
    values
  );
  res.json({ ok: true });
});

// ── Profile Comments ────────────────────────────────────────
router.get('/user/:username/comments', async (req, res) => {
  const { rows: userRows } = await pool.query(
    'SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [req.params.username]
  );
  if (!userRows[0]) return res.status(404).json({ error: 'User not found' });
  const { rows } = await pool.query(
    `SELECT pc.*, u.username AS author_username, u.avatar_url AS author_avatar
     FROM profile_comments pc
     JOIN users u ON u.id = pc.author_id
     WHERE pc.profile_user_id = $1
     ORDER BY pc.created_at DESC
     LIMIT 50`,
    [userRows[0].id]
  );
  res.json(rows.map((r) => ({
    id: r.id, body: r.body, createdAt: r.created_at,
    authorId: r.author_id, authorUsername: r.author_username, authorAvatar: r.author_avatar,
  })));
});

router.post('/user/:username/comments', async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Body required' });
  const { rows: userRows } = await pool.query(
    'SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [req.params.username]
  );
  if (!userRows[0]) return res.status(404).json({ error: 'User not found' });
  const id = uid();
  await pool.query(
    'INSERT INTO profile_comments (id, profile_user_id, author_id, body) VALUES ($1, $2, $3, $4)',
    [id, userRows[0].id, req.userId, body.trim().slice(0, 500)]
  );
  // Notify profile owner
  if (userRows[0].id !== req.userId) {
    const actor = await getUsername(req.userId);
    await notify(userRows[0].id, req.userId, 'profile_comment',
      `${actor} left a comment on your profile`, 'profile', userRows[0].id);
  }
  const { rows } = await pool.query(
    `SELECT pc.*, u.username AS author_username, u.avatar_url AS author_avatar
     FROM profile_comments pc JOIN users u ON u.id = pc.author_id WHERE pc.id = $1`, [id]
  );
  const r = rows[0];
  res.json({
    id: r.id, body: r.body, createdAt: r.created_at,
    authorId: r.author_id, authorUsername: r.author_username, authorAvatar: r.author_avatar,
  });
});

router.delete('/comments/:id', async (req, res) => {
  // Only the author or profile owner can delete
  const { rows } = await pool.query('SELECT * FROM profile_comments WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  if (rows[0].author_id !== req.userId && rows[0].profile_user_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await pool.query('DELETE FROM profile_comments WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ── Nicknames ───────────────────────────────────────────────
// Set a private nickname for another user
router.put('/nickname/:userId', async (req, res) => {
  const { nickname } = req.body;
  if (!nickname?.trim()) {
    // Remove nickname
    await pool.query('DELETE FROM user_nicknames WHERE user_id = $1 AND target_user_id = $2',
      [req.userId, req.params.userId]);
    return res.json({ ok: true });
  }
  await pool.query(
    `INSERT INTO user_nicknames (id, user_id, target_user_id, nickname) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, target_user_id) DO UPDATE SET nickname = $4`,
    [uid(), req.userId, req.params.userId, nickname.trim().slice(0, 30)]
  );
  res.json({ ok: true });
});

// Get all your private nicknames
router.get('/nicknames', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT target_user_id, nickname FROM user_nicknames WHERE user_id = $1', [req.userId]
  );
  const map = {};
  rows.forEach((r) => { map[r.target_user_id] = r.nickname; });
  res.json(map);
});

// ── Friendships (Ahbab) ────────────────────────────────────
// Send friend request
router.post('/friend/:userId', async (req, res) => {
  if (req.params.userId === req.userId) return res.status(400).json({ error: 'Cannot friend yourself' });
  // Check if already exists
  const { rows: existing } = await pool.query(
    `SELECT * FROM friendships WHERE
     (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [req.userId, req.params.userId]
  );
  if (existing[0]) {
    if (existing[0].status === 'accepted') return res.json({ status: 'friends' });
    if (existing[0].user_id === req.userId) return res.json({ status: 'pending_sent' });
    // They sent us a request — accept it
    await pool.query('UPDATE friendships SET status = $1 WHERE id = $2', ['accepted', existing[0].id]);
    const actor = await getUsername(req.userId);
    await notify(req.params.userId, req.userId, 'friend_accepted',
      `${actor} accepted your friend request`, 'profile', req.userId);
    return res.json({ status: 'friends' });
  }
  await pool.query(
    'INSERT INTO friendships (id, user_id, friend_id, status) VALUES ($1, $2, $3, $4)',
    [uid(), req.userId, req.params.userId, 'pending']
  );
  const actor = await getUsername(req.userId);
  await notify(req.params.userId, req.userId, 'friend_request',
    `${actor} sent you a friend request`, 'profile', req.userId);
  res.json({ status: 'pending_sent' });
});

// Accept friend request
router.put('/friend/:userId/accept', async (req, res) => {
  await pool.query(
    `UPDATE friendships SET status = 'accepted'
     WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
    [req.params.userId, req.userId]
  );
  const actor = await getUsername(req.userId);
  await notify(req.params.userId, req.userId, 'friend_accepted',
    `${actor} accepted your friend request`, 'profile', req.userId);
  res.json({ status: 'friends' });
});

// Remove friend / cancel request / reject
router.delete('/friend/:userId', async (req, res) => {
  await pool.query(
    `DELETE FROM friendships WHERE
     (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [req.userId, req.params.userId]
  );
  res.json({ ok: true });
});

// List friends
router.get('/friends', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.avatar_url, u.nickname, u.bio, f.status, f.user_id AS requester_id
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
     WHERE (f.user_id = $1 OR f.friend_id = $1)
     ORDER BY f.created_at DESC`,
    [req.userId]
  );
  res.json(rows.map((r) => ({
    id: r.id, username: r.username, avatarUrl: r.avatar_url,
    nickname: r.nickname, bio: r.bio,
    status: r.status,
    direction: r.requester_id === req.userId ? 'sent' : 'received',
  })));
});

export default router;
