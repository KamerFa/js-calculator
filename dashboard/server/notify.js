import pool, { uid } from './db.js';

/**
 * Create a notification for a user.
 * Skips if actorId === userId (don't notify yourself).
 */
async function notify(userId, actorId, type, summary, targetType, targetId) {
  if (userId === actorId) return; // don't notify yourself
  await pool.query(
    `INSERT INTO notifications (id, user_id, actor_id, type, summary, target_type, target_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [uid(), userId, actorId, type, summary, targetType || null, targetId || null]
  );
}

/**
 * Notify all members of a project except the actor.
 */
async function notifyProjectMembers(projectId, actorId, type, summary, targetType, targetId) {
  const { rows } = await pool.query(
    `SELECT user_id FROM project_members WHERE project_id = $1 AND user_id != $2`,
    [projectId, actorId]
  );
  for (const row of rows) {
    await notify(row.user_id, actorId, type, summary, targetType, targetId);
  }
}

/**
 * Get actor username for notification messages.
 */
async function getUsername(userId) {
  const { rows } = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
  return rows[0]?.username || 'Someone';
}

export { notify, notifyProjectMembers, getUsername };
