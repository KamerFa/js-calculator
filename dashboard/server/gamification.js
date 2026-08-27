// ============================================================
// GAMIFICATION ENGINE — XP, Levels, Achievements
// ============================================================

import pool from './db.js';
import { randomUUID } from 'crypto';

const uid = () => randomUUID();

// ── Level thresholds ──────────────────────────────────────────
const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500];
const LEVEL_TITLES = [
  'Starter', 'Apprentice', 'Builder', 'Adept', 'Expert',
  'Master', 'Grandmaster', 'Legend', 'Mythic', 'Transcendent',
];

export function getLevel(xp) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export function getLevelProgress(xp) {
  const level = getLevel(xp);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] || currentThreshold + 1000;
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    currentXP: xp,
    levelXP: xp - currentThreshold,
    levelTarget: nextThreshold - currentThreshold,
    progress: Math.min((xp - currentThreshold) / (nextThreshold - currentThreshold), 1),
  };
}

// ── XP calculation ────────────────────────────────────────────
const EFFORT_BONUS = { easy: 0, medium: 5, hard: 15, epic: 30 };

export function calculateTaskXP(priority, effort, currentStreak) {
  const base = priority === 'high' ? 30 : priority === 'medium' ? 20 : 10;
  const effortBonus = EFFORT_BONUS[effort] || 0;
  const streakBonus = Math.min((currentStreak || 0) * 5, 50);
  return base + effortBonus + streakBonus;
}

export const FOCUS_SESSION_XP = 15;

// ── Award XP ──────────────────────────────────────────────────
export async function awardXP(userId, amount, reason, sourceId = null) {
  if (amount <= 0) return;

  await pool.query(
    `INSERT INTO xp_log (id, user_id, amount, reason, source_id) VALUES ($1, $2, $3, $4, $5)`,
    [uid(), userId, amount, reason, sourceId]
  );

  const { rows } = await pool.query(
    `UPDATE users SET xp = xp + $1 WHERE id = $2 RETURNING xp`,
    [amount, userId]
  );

  const newXP = rows[0]?.xp || 0;
  const newLevel = getLevel(newXP);
  await pool.query(`UPDATE users SET level = $1 WHERE id = $2`, [newLevel, userId]);

  await checkAchievements(userId);
  return { xp: newXP, level: newLevel };
}

// ── Daily first-task bonus ────────────────────────────────────
export async function checkDailyBonus(userId) {
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await pool.query(
    `SELECT id FROM xp_log WHERE user_id = $1 AND reason = 'daily_bonus' AND created_at::date = $2::date LIMIT 1`,
    [userId, today]
  );
  if (rows.length === 0) {
    await awardXP(userId, 10, 'daily_bonus');
    return true;
  }
  return false;
}

// ── Achievement definitions ───────────────────────────────────
export const ACHIEVEMENTS = [
  {
    id: 'first_task', name: 'First Steps', desc: 'Complete your first task', icon: '\uD83C\uDF31', xp: 20,
    check: async (uid) => {
      const { rows } = await pool.query(`SELECT COUNT(*) as c FROM task_completion_log WHERE user_id = $1`, [uid]);
      return parseInt(rows[0].c) >= 1;
    },
  },
  {
    id: 'task_10', name: 'Getting Started', desc: 'Complete 10 tasks', icon: '\u26A1', xp: 50,
    check: async (uid) => {
      const { rows } = await pool.query(`SELECT COUNT(*) as c FROM task_completion_log WHERE user_id = $1`, [uid]);
      return parseInt(rows[0].c) >= 10;
    },
  },
  {
    id: 'task_50', name: 'Halfway There', desc: 'Complete 50 tasks', icon: '\uD83D\uDE80', xp: 100,
    check: async (uid) => {
      const { rows } = await pool.query(`SELECT COUNT(*) as c FROM task_completion_log WHERE user_id = $1`, [uid]);
      return parseInt(rows[0].c) >= 50;
    },
  },
  {
    id: 'task_100', name: 'Centurion', desc: 'Complete 100 tasks', icon: '\uD83D\uDC8E', xp: 200,
    check: async (uid) => {
      const { rows } = await pool.query(`SELECT COUNT(*) as c FROM task_completion_log WHERE user_id = $1`, [uid]);
      return parseInt(rows[0].c) >= 100;
    },
  },
  {
    id: 'streak_3', name: 'On a Roll', desc: '3-day streak', icon: '\uD83D\uDD25', xp: 30,
    check: async (uid) => {
      const { rows } = await pool.query(`SELECT MAX(current_streak) as m FROM tasks WHERE user_id = $1`, [uid]);
      return parseInt(rows[0].m || 0) >= 3;
    },
  },
  {
    id: 'streak_7', name: 'Week Warrior', desc: '7-day streak', icon: '\u2694\uFE0F', xp: 75,
    check: async (uid) => {
      const { rows } = await pool.query(`SELECT MAX(current_streak) as m FROM tasks WHERE user_id = $1`, [uid]);
      return parseInt(rows[0].m || 0) >= 7;
    },
  },
  {
    id: 'streak_30', name: 'Monthly Master', desc: '30-day streak', icon: '\uD83D\uDC51', xp: 300,
    check: async (uid) => {
      const { rows } = await pool.query(`SELECT MAX(best_streak) as m FROM tasks WHERE user_id = $1`, [uid]);
      return parseInt(rows[0].m || 0) >= 30;
    },
  },
  {
    id: 'focus_1', name: 'Deep Dive', desc: 'Complete a focus session', icon: '\uD83C\uDFAF', xp: 20,
    check: async (uid) => {
      const { rows } = await pool.query(`SELECT COUNT(*) as c FROM focus_sessions WHERE user_id = $1 AND completed_at IS NOT NULL`, [uid]);
      return parseInt(rows[0].c) >= 1;
    },
  },
  {
    id: 'focus_10', name: 'Focus Apprentice', desc: '10 focus sessions', icon: '\uD83E\uDDD8', xp: 100,
    check: async (uid) => {
      const { rows } = await pool.query(`SELECT COUNT(*) as c FROM focus_sessions WHERE user_id = $1 AND completed_at IS NOT NULL`, [uid]);
      return parseInt(rows[0].c) >= 10;
    },
  },
  {
    id: 'focus_50', name: 'Flow State', desc: '50 focus sessions', icon: '\uD83C\uDF0A', xp: 250,
    check: async (uid) => {
      const { rows } = await pool.query(`SELECT COUNT(*) as c FROM focus_sessions WHERE user_id = $1 AND completed_at IS NOT NULL`, [uid]);
      return parseInt(rows[0].c) >= 50;
    },
  },
  {
    id: 'hat_trick', name: 'Hat Trick', desc: '3 tasks in one day', icon: '\uD83C\uDFA9', xp: 40,
    check: async (uid) => {
      const { rows } = await pool.query(
        `SELECT completion_date FROM task_completion_log WHERE user_id = $1 GROUP BY completion_date HAVING COUNT(*) >= 3 LIMIT 1`, [uid]
      );
      return rows.length > 0;
    },
  },
  {
    id: 'power_day', name: 'Power Day', desc: '10 tasks in one day', icon: '\uD83D\uDCAA', xp: 150,
    check: async (uid) => {
      const { rows } = await pool.query(
        `SELECT completion_date FROM task_completion_log WHERE user_id = $1 GROUP BY completion_date HAVING COUNT(*) >= 10 LIMIT 1`, [uid]
      );
      return rows.length > 0;
    },
  },
  {
    id: 'social_10', name: 'Social Starter', desc: 'Send 10 messages', icon: '\uD83D\uDCAC', xp: 30,
    check: async (uid) => {
      const { rows } = await pool.query(
        `SELECT (SELECT COUNT(*) FROM direct_messages WHERE sender_id = $1) + (SELECT COUNT(*) FROM project_messages WHERE user_id = $1) + (SELECT COUNT(*) FROM group_messages WHERE user_id = $1) as c`, [uid]
      );
      return parseInt(rows[0].c) >= 10;
    },
  },
  {
    id: 'night_owl', name: 'Night Owl', desc: 'Complete a task after 11 PM', icon: '\uD83E\uDD89', xp: 25,
    check: async (uid) => {
      const { rows } = await pool.query(
        `SELECT id FROM task_completion_log WHERE user_id = $1 AND EXTRACT(HOUR FROM completed_at) >= 23 LIMIT 1`, [uid]
      );
      return rows.length > 0;
    },
  },
  {
    id: 'early_bird', name: 'Early Bird', desc: 'Complete a task before 7 AM', icon: '\uD83D\uDC26', xp: 25,
    check: async (uid) => {
      const { rows } = await pool.query(
        `SELECT id FROM task_completion_log WHERE user_id = $1 AND EXTRACT(HOUR FROM completed_at) < 7 LIMIT 1`, [uid]
      );
      return rows.length > 0;
    },
  },
];

// ── Check & unlock achievements ───────────────────────────────
async function checkAchievements(userId) {
  const { rows: unlocked } = await pool.query(
    `SELECT achievement_id FROM user_achievements WHERE user_id = $1`, [userId]
  );
  const unlockedSet = new Set(unlocked.map((r) => r.achievement_id));

  for (const a of ACHIEVEMENTS) {
    if (unlockedSet.has(a.id)) continue;
    try {
      const earned = await a.check(userId);
      if (earned) {
        await pool.query(
          `INSERT INTO user_achievements (id, user_id, achievement_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [uid(), userId, a.id]
        );
        if (a.xp > 0) {
          await pool.query(
            `INSERT INTO xp_log (id, user_id, amount, reason, source_id) VALUES ($1, $2, $3, $4, $5)`,
            [uid(), userId, a.xp, 'achievement', a.id]
          );
          const { rows: xpRows } = await pool.query(
            `UPDATE users SET xp = xp + $1 WHERE id = $2 RETURNING xp`, [a.xp, userId]
          );
          const newXP = xpRows[0]?.xp || 0;
          await pool.query(`UPDATE users SET level = $1 WHERE id = $2`, [getLevel(newXP), userId]);
        }
      }
    } catch { /* non-fatal */ }
  }
}
