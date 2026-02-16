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
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'none'`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_by TEXT REFERENCES users(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS screenshot_url TEXT`);

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
  await seedRamadanProject();
  await seedBugListProject();
}

async function seedRamadanProject() {
  const RAMADAN_ID = 'global-ramadan';
  const { rows } = await pool.query('SELECT id FROM projects WHERE id = $1', [RAMADAN_ID]);
  if (rows.length > 0) return;

  const SYS_USER = 'system-global';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO projects (id, user_id, name, description, color, is_public, is_global)
       VALUES ($1, $2, $3, $4, $5, true, true)`,
      [
        RAMADAN_ID,
        SYS_USER,
        'Ramadan',
        'Track your fasting, salah, and dhikr throughout Ramadan. Join the community!',
        '#1a7a4c',
      ]
    );

    await client.query(
      `INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, 'owner')`,
      [uid(), RAMADAN_ID, SYS_USER]
    );

    // Tasks categorised by Islamic obligation level
    // recurrence: 'daily' auto-resets each day, 'none' is a one-off goal
    const tasks = [
      // ─── Fard (Obligatory) ───────────────────────────────
      { title: 'Fajr Prayer',              desc: 'Perform Fajr salah on time (Fard - Quran 17:78)',                                             priority: 'high', rec: 'daily' },
      { title: 'Dhuhr Prayer',             desc: 'Perform Dhuhr salah on time (Fard - Quran 17:78)',                                             priority: 'high', rec: 'daily' },
      { title: 'Asr Prayer',               desc: 'Perform Asr salah on time (Fard - Quran 103:1-3, Bukhari 553)',                                priority: 'high', rec: 'daily' },
      { title: 'Maghrib Prayer',           desc: 'Perform Maghrib salah on time (Fard - Quran 17:78)',                                           priority: 'high', rec: 'daily' },
      { title: 'Isha Prayer',              desc: 'Perform Isha salah on time (Fard - Quran 17:78)',                                              priority: 'high', rec: 'daily' },
      { title: 'Fast from Suhoor to Iftar',desc: 'Keep the obligatory fast (Fard - Quran 2:183)',                                                priority: 'high', rec: 'daily' },
      { title: 'Zakat al-Fitr',            desc: 'Pay Zakat al-Fitr before Eid prayer (Wajib - Bukhari 1503)',                                   priority: 'high', rec: 'none' },

      // ─── Sunnah Muakkadah (Strongly Recommended) ─────────
      { title: 'Taraweeh Prayer',          desc: 'Pray Taraweeh after Isha (Sunnah Muakkadah - Bukhari 37)',                                     priority: 'medium', rec: 'daily' },
      { title: 'Suhoor Meal',              desc: 'Eat suhoor before Fajr - "Take suhoor, for in suhoor there is blessing" (Bukhari 1923)',       priority: 'medium', rec: 'daily' },
      { title: 'Break fast with dates',    desc: 'Break fast with dates and water (Sunnah - Abu Dawud 2356)',                                    priority: 'medium', rec: 'daily' },
      { title: 'Dua at Iftar',             desc: '"Dhahaba al-zama wa abtallatil-urooq..." (Abu Dawud 2357)',                                    priority: 'medium', rec: 'daily' },
      { title: 'Morning Adhkar',           desc: 'Recite morning remembrance after Fajr (Sunnah - Muslim 2723)',                                 priority: 'medium', rec: 'daily' },
      { title: 'Evening Adhkar',           desc: 'Recite evening remembrance after Asr (Sunnah - Muslim 2723)',                                  priority: 'medium', rec: 'daily' },
      { title: 'Quran Recitation',         desc: 'Read at least 1 juz daily to complete Quran in Ramadan (Sunnah - Bukhari 4998)',               priority: 'medium', rec: 'daily' },
      { title: 'Tasbeeh after Salah',      desc: 'SubhanAllah 33x, Alhamdulillah 33x, Allahu Akbar 34x after each salah (Muslim 595)',          priority: 'medium', rec: 'daily' },

      // ─── Mustahabb (Recommended) ─────────────────────────
      { title: 'Tahajjud / Qiyam al-Layl', desc: 'Night prayer in last third of night (Mustahabb - Quran 17:79)',                               priority: 'low', rec: 'daily' },
      { title: 'Istighfar 100x',           desc: 'Seek forgiveness - "I seek Allah\'s forgiveness 100 times a day" (Muslim 2702)',               priority: 'low', rec: 'daily' },
      { title: 'La ilaha illa Allah 100x', desc: 'Daily dhikr (Bukhari 6403, Muslim 2691)',                                                     priority: 'low', rec: 'daily' },
      { title: 'Salawat upon the Prophet',  desc: 'Send blessings upon the Prophet (Quran 33:56, Muslim 408)',                                  priority: 'low', rec: 'daily' },
      { title: 'Charity / Sadaqah',        desc: 'The Prophet was most generous in Ramadan (Bukhari 6, Muslim 2308)',                            priority: 'low', rec: 'daily' },
      { title: 'Dua: Allahumma innaka afuwwun...', desc: '"O Allah, You are pardoning and love to pardon, so pardon me" (Tirmidhi 3513)',       priority: 'low', rec: 'daily' },
      { title: 'Feed someone Iftar',       desc: '"Whoever provides iftar for a fasting person earns the same reward" (Tirmidhi 807)',           priority: 'low', rec: 'none' },
      { title: 'Itikaf (Last 10 days)',    desc: 'Spiritual retreat in the masjid (Sunnah - Bukhari 2025)',                                     priority: 'low', rec: 'none' },
      { title: 'Seek Laylat al-Qadr',      desc: 'Especially in odd nights of last 10 days (Quran 97:1-5, Bukhari 2020)',                       priority: 'low', rec: 'none' },
    ];

    for (const t of tasks) {
      await client.query(
        `INSERT INTO tasks (id, user_id, project_id, title, description, status, priority, recurrence)
         VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7)`,
        [uid(), SYS_USER, RAMADAN_ID, t.title, t.desc, t.priority, t.rec]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Ramadan seed error (may already exist):', e.message);
  } finally {
    client.release();
  }
}

async function seedBugListProject() {
  const BUG_ID = 'global-bug-list';
  const SYS_USER = 'system-global';
  const { rows } = await pool.query('SELECT id FROM projects WHERE id = $1', [BUG_ID]);
  if (rows.length > 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO projects (id, user_id, name, description, color, is_public, is_global)
       VALUES ($1, $2, $3, $4, $5, true, true)`,
      [BUG_ID, SYS_USER, 'Bug List', 'Report bugs with screenshots. Anyone can fix and mark as done!', '#c0392b']
    );
    await client.query(
      `INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, 'owner')`,
      [uid(), BUG_ID, SYS_USER]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Bug List seed error (may already exist):', e.message);
  } finally {
    client.release();
  }
}

export const uid = () => randomUUID();
export { pool, initDB };
export default pool;
