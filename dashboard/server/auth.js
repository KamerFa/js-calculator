import jwt from 'jsonwebtoken';
import pool from './db.js';

const SECRET = process.env.JWT_SECRET || 'dash_dev_secret_change_in_prod';

export function signToken(userId) {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '7d' });
}

// Debounce last_active_at updates: only write once per 60s per user
const lastTouched = new Map();

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const payload = jwt.verify(header.slice(7), SECRET);
    req.userId = payload.sub;

    // Touch last_active_at (debounced to every 60s)
    const now = Date.now();
    const last = lastTouched.get(req.userId) || 0;
    if (now - last > 60000) {
      lastTouched.set(req.userId, now);
      pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [req.userId]).catch(() => {});
    }

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Derive effective presence from user row.
 * - If user manually set 'dnd' or 'offline' (invisible), respect that
 * - Otherwise derive from last_active_at:
 *   - Active: last seen within 5 minutes
 *   - Away/Idle: last seen 5–30 minutes ago
 *   - Offline: last seen more than 30 minutes ago
 * - If show_online_status is false, always return 'offline'
 */
export function derivePresence(user) {
  if (user.show_online_status === false) return 'offline';

  const manual = user.presence;
  // If user explicitly set dnd or invisible, respect it
  if (manual === 'dnd' || manual === 'offline') return manual;

  const lastActive = user.last_active_at ? new Date(user.last_active_at).getTime() : 0;
  const ago = Date.now() - lastActive;
  const FIVE_MIN = 5 * 60 * 1000;
  const THIRTY_MIN = 30 * 60 * 1000;

  if (ago < FIVE_MIN) return 'active';
  if (ago < THIRTY_MIN) return 'away';
  return 'offline';
}
