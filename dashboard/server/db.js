import pg from 'pg';
import { randomUUID } from 'crypto';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Schema ──────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      username    TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      color       TEXT NOT NULL DEFAULT '#2a5caa',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'todo',
      priority      TEXT NOT NULL DEFAULT 'medium',
      due_date      TEXT,
      custom_fields TEXT NOT NULL DEFAULT '[]',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notes (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      body        TEXT NOT NULL DEFAULT '',
      attached_to TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role        TEXT NOT NULL DEFAULT 'member',
      joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS tweets (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body        TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Add columns if they don't exist (safe for re-runs)
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date DATE`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'none'`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_by TEXT REFERENCES users(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS screenshot_url TEXT`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date TEXT`);

  // User profile columns
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS music_service TEXT`);  // spotify, youtube, tidal
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS music_username TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS show_projects_on_profile BOOLEAN NOT NULL DEFAULT true`);

  // Online status / presence
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS presence TEXT NOT NULL DEFAULT 'active'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status_emoji TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status_text TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN NOT NULL DEFAULT true`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z'`);
  await pool.query(`ALTER TABLE users ALTER COLUMN last_active_at SET DEFAULT '1970-01-01T00:00:00Z'`);
  // One-time fix: if ALL users have nearly identical last_active_at (from old DEFAULT NOW() migration),
  // reset them so inactive users correctly show as offline.
  const { rows: [{ all_same }] } = await pool.query(
    `SELECT (MAX(last_active_at) - MIN(last_active_at) < INTERVAL '2 minutes')
       AND MIN(last_active_at) > '2020-01-01' AS all_same
     FROM users`
  );
  if (all_same) {
    await pool.query(`UPDATE users SET last_active_at = '1970-01-01T00:00:00Z'`);
  }

  // Tweet reactions & comments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tweet_reactions (
      id          TEXT PRIMARY KEY,
      tweet_id    TEXT NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji       TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tweet_id, user_id, emoji)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tweet_comments (
      id          TEXT PRIMARY KEY,
      tweet_id    TEXT NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body        TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Per-member task tracking
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'shared'`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_completions (
      id           TEXT PRIMARY KEY,
      task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(task_id, user_id)
    )
  `);

  // Add completion_date for per-date tracking of recurring tasks
  await pool.query(`ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS completion_date TEXT`);
  // Backfill existing records: set completion_date from completed_at
  await pool.query(`UPDATE task_completions SET completion_date = completed_at::date::text WHERE completion_date IS NULL`);
  // Drop old unique constraint and add new one with completion_date
  await pool.query(`ALTER TABLE task_completions DROP CONSTRAINT IF EXISTS task_completions_task_id_user_id_key`);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'task_completions_task_user_date_key'
      ) THEN
        ALTER TABLE task_completions ADD CONSTRAINT task_completions_task_user_date_key UNIQUE(task_id, user_id, completion_date);
      END IF;
    END $$
  `);

  // Task completion history log (append-only, for streaks & stats)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_completion_log (
      id              TEXT PRIMARY KEY,
      task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completion_date TEXT NOT NULL
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_task_completion_log_task ON task_completion_log(task_id, user_id, completed_at DESC)`);

  // Streak & completion count columns on tasks
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS best_streak INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_count INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ`);

  // Notification preferences on users
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences TEXT NOT NULL DEFAULT '{}'`);

  // Focus sessions (Pomodoro timer)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id      TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      duration     INTEGER NOT NULL DEFAULT 1500,
      started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      session_date TEXT NOT NULL
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_focus_sessions_user ON focus_sessions(user_id, session_date)`);

  // Notifications
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
      type         TEXT NOT NULL,
      summary      TEXT NOT NULL,
      target_type  TEXT,
      target_id    TEXT,
      is_read      BOOLEAN NOT NULL DEFAULT false,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC)`);

  // Comment votes (upvote/downvote)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comment_votes (
      id           TEXT PRIMARY KEY,
      comment_id   TEXT NOT NULL REFERENCES tweet_comments(id) ON DELETE CASCADE,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vote         INTEGER NOT NULL CHECK (vote IN (-1, 1)),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(comment_id, user_id)
    )
  `);

  // Project chat messages
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_messages (
      id           TEXT PRIMARY KEY,
      project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body         TEXT NOT NULL,
      mentions     TEXT[] NOT NULL DEFAULT '{}',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_project_messages_project ON project_messages(project_id, created_at DESC)`);

  // Profile comments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profile_comments (
      id           TEXT PRIMARY KEY,
      profile_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body         TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profile_comments_profile ON profile_comments(profile_user_id, created_at DESC)`);

  // User nicknames (user sets a nickname for another user, private to the namer)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_nicknames (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nickname     TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, target_user_id)
    )
  `);

  // Display nickname (user's own public nickname)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT`);

  // Friendships (ahbab)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS friendships (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status       TEXT NOT NULL DEFAULT 'pending',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, friend_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id, status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id, status)`);

  // Item comments (generic: tasks, projects, notes)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS item_comments (
      id           TEXT PRIMARY KEY,
      target_type  TEXT NOT NULL,
      target_id    TEXT NOT NULL,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body         TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_item_comments_target ON item_comments(target_type, target_id, created_at DESC)`);

  // Radio listeners – track who's currently listening to what
  await pool.query(`
    CREATE TABLE IF NOT EXISTS radio_listeners (
      user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      station_id   TEXT NOT NULL,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Radio station broken reports (2 unique reports = auto-hide)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS station_reports (
      id           TEXT PRIMARY KEY,
      station_id   TEXT NOT NULL,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(station_id, user_id)
    )
  `);

  // ── Direct messages ──────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS direct_messages (
      id           TEXT PRIMARY KEY,
      sender_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body         TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dm_pair ON direct_messages(LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id, created_at DESC)`);

  // DM read cursors (unread tracking)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_read_cursors (
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      other_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_read_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, other_user_id)
    )
  `);

  // Project message read cursors (unread tracking for channels)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_message_read_cursors (
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, project_id)
    )
  `);

  // ── Message reactions (unified for DMs + project messages) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_reactions (
      id           TEXT PRIMARY KEY,
      message_id   TEXT NOT NULL,
      message_type TEXT NOT NULL CHECK (message_type IN ('dm', 'project')),
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji        TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(message_id, message_type, user_id, emoji)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_message_reactions_msg ON message_reactions(message_id, message_type)`);

  // ── Reply-to columns ──
  await pool.query(`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT`);
  await pool.query(`ALTER TABLE project_messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT`);

  // ── Thread-only flag (Slack-style threads) ──
  await pool.query(`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS thread_only BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE project_messages ADD COLUMN IF NOT EXISTS thread_only BOOLEAN NOT NULL DEFAULT false`);

  // ── Typing indicators ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS typing_indicators (
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL,
      target_id   TEXT NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, target_type, target_id)
    )
  `);

  // ── Group chats ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_chats (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      color       TEXT NOT NULL DEFAULT '#2a5caa',
      creator_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_members (
      id        TEXT PRIMARY KEY,
      group_id  TEXT NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role      TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(group_id, user_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_messages (
      id          TEXT PRIMARY KEY,
      group_id    TEXT NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body        TEXT NOT NULL,
      reply_to_id TEXT,
      thread_only BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_message_read_cursors (
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_id    TEXT NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
      last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, group_id)
    )
  `);

  // ── Gamification: XP, Levels, Achievements ─────────────────
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS effort TEXT NOT NULL DEFAULT 'medium'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS xp_log (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount      INTEGER NOT NULL,
      reason      TEXT NOT NULL,
      source_id   TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_xp_log_user ON xp_log(user_id, created_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id  TEXT NOT NULL,
      unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, achievement_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id)`);

  // ── Performance indexes ─────────────────────────────────────
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tweet_reactions_tweet_id ON tweet_reactions(tweet_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tweet_comments_tweet_id ON tweet_comments(tweet_id, created_at ASC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON tasks(recurrence) WHERE recurrence != 'none'`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dm_created ON direct_messages(created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_comment_votes_comment ON comment_votes(comment_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username))`);

  // ── Delete Ramadan project completely (no longer needed) ──
  await pool.query(`DELETE FROM task_completions WHERE task_id IN (SELECT id FROM tasks WHERE project_id = 'global-ramadan')`);
  await pool.query(`DELETE FROM tasks WHERE project_id = 'global-ramadan'`);
  await pool.query(`DELETE FROM project_members WHERE project_id = 'global-ramadan'`);
  await pool.query(`DELETE FROM projects WHERE id = 'global-ramadan'`);

  // Backfill: ensure every existing project owner has a project_members entry
  await pool.query(`
    INSERT INTO project_members (id, project_id, user_id, role)
    SELECT gen_random_uuid()::text, p.id, p.user_id, 'owner'
    FROM projects p
    WHERE NOT EXISTS (
      SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = p.user_id
    )
    ON CONFLICT DO NOTHING
  `);

  // ── Remove old Ramadan project (was seeded incorrectly) ──
  await pool.query(`DELETE FROM projects WHERE id = 'global-ramadan-2026'`);

  // ── Ensure system user exists for global projects ─────────
  const SYS_USER = 'system-global';
  const { rows: sysRows } = await pool.query('SELECT id FROM users WHERE id = $1', [SYS_USER]);
  if (sysRows.length === 0) {
    await pool.query(
      `INSERT INTO users (id, username, password) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [SYS_USER, '_system', 'nologin']
    );
  }

  // ── Seed global projects if they don't exist ─────────────
  await seedBugListProject();
  await seedDhikrProject();
}

async function seedBugListProject() {
  const BUG_ID = 'global-bug-list';
  const SYS_USER = 'system-global';

  // Rename existing Bug List to Insider List
  await pool.query(
    `UPDATE projects SET name = 'Insider List', description = 'Feature requests, bug reports, and ideas. Anyone can contribute!' WHERE id = $1`,
    [BUG_ID]
  );

  const { rows } = await pool.query('SELECT id FROM projects WHERE id = $1', [BUG_ID]);
  if (rows.length > 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO projects (id, user_id, name, description, color, is_public, is_global)
       VALUES ($1, $2, $3, $4, $5, true, true)`,
      [BUG_ID, SYS_USER, 'Insider List', 'Feature requests, bug reports, and ideas. Anyone can contribute!', '#c0392b']
    );
    await client.query(
      `INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, 'owner')`,
      [uid(), BUG_ID, SYS_USER]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Insider List seed error (may already exist):', e.message);
  } finally {
    client.release();
  }
}

async function seedDhikrProject() {
  const DHIKR_ID = 'global-dhikr-duas';
  const SYS_USER = 'system-global';

  const { rows } = await pool.query('SELECT id FROM projects WHERE id = $1', [DHIKR_ID]);
  if (rows.length > 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO projects (id, user_id, name, description, color, is_public, is_global)
       VALUES ($1, $2, $3, $4, $5, true, true)`,
      [DHIKR_ID, SYS_USER, 'Dhikr & Duas', 'Daily, weekly, and monthly dhikr and duas. Track your spiritual practice together.', '#1B5E20']
    );
    await client.query(
      `INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, 'owner')`,
      [uid(), DHIKR_ID, SYS_USER]
    );

    // Daily dhikr tasks
    const dailyTasks = [
      'Morning Adhkar (Sabah)',
      'Evening Adhkar (Masa)',
      'SubhanAllah x33, Alhamdulillah x33, Allahu Akbar x34',
      'Ayatul Kursi after each salah',
      'Dua before sleeping',
      'Dua upon waking up',
      'Bismillah before eating',
      'Istighfar x100 (Astaghfirullah)',
      'Salawat upon the Prophet x10',
    ];
    for (const title of dailyTasks) {
      await client.query(
        `INSERT INTO tasks (id, user_id, project_id, title, status, priority, recurrence, task_type)
         VALUES ($1, $2, $3, $4, 'todo', 'high', 'daily', 'per_member')`,
        [uid(), SYS_USER, DHIKR_ID, title]
      );
    }

    // Weekly tasks
    const weeklyTasks = [
      'Read Surah Al-Kahf (Friday)',
      'Salawat upon the Prophet (Friday, abundantly)',
      'Make dua on Friday before Maghrib',
      'Fast Monday or Thursday (Sunnah)',
    ];
    for (const title of weeklyTasks) {
      await client.query(
        `INSERT INTO tasks (id, user_id, project_id, title, status, priority, recurrence, task_type)
         VALUES ($1, $2, $3, $4, 'todo', 'medium', 'weekly', 'per_member')`,
        [uid(), SYS_USER, DHIKR_ID, title]
      );
    }

    // Monthly tasks
    const monthlyTasks = [
      'Complete reading one Juz of Quran',
      'Give Sadaqah (charity)',
      'Fast 3 days (13th, 14th, 15th - Ayyamul Bid)',
      'Visit or call a family member / friend for Allah\'s sake',
      'Make tawbah and reflect on the past month',
    ];
    for (const title of monthlyTasks) {
      await client.query(
        `INSERT INTO tasks (id, user_id, project_id, title, status, priority, recurrence, task_type)
         VALUES ($1, $2, $3, $4, 'todo', 'medium', 'monthly', 'per_member')`,
        [uid(), SYS_USER, DHIKR_ID, title]
      );
    }

    await client.query('COMMIT');
    console.log('Dhikr & Duas project seeded successfully');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Dhikr & Duas seed error (may already exist):', e.message);
  } finally {
    client.release();
  }
}

export const uid = () => randomUUID();
export { pool, initDB };
export default pool;
