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

  // User profile columns
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS music_service TEXT`);  // spotify, youtube, tidal
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS music_username TEXT`);

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

  // Backfill: mark existing Ramadan tasks as per_member
  await pool.query(`UPDATE tasks SET task_type = 'per_member' WHERE project_id = 'global-ramadan' AND task_type = 'shared'`);

  // ── Delete old Ramadan project to re-seed with strictly Ramadan tasks ──
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
      `INSERT INTO projects (id, user_id, name, description, color, is_public, is_global, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, true, true, $6, $7)`,
      [
        RAMADAN_ID,
        SYS_USER,
        'Ramazan 2026',
        'Prati svoj post, ibadet i dobra djela tokom Ramazana. Pridruzi se zajednici!',
        '#1a7a4c',
        '2026-02-17',  // 1 day before Ramadan starts (~Feb 18)
        '2026-03-22',  // 3 days after Ramadan ends (~Mar 19) for Bajram
      ]
    );

    await client.query(
      `INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, 'owner')`,
      [uid(), RAMADAN_ID, SYS_USER]
    );

    // Add kamer and admin as owners so they can edit the project
    for (const username of ['kamer', 'admin']) {
      const { rows: userRows } = await client.query(
        'SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]
      );
      if (userRows.length > 0) {
        await client.query(
          `INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, 'owner') ON CONFLICT DO NOTHING`,
          [uid(), RAMADAN_ID, userRows[0].id]
        );
      }
    }

    // Strictly Ramadan-specific tasks only
    // recurrence: 'daily' auto-resets each day, 'none' is a one-off goal
    const tasks = [
      // ─── Post (Fasting) ─────────────────────────────────
      { title: 'Post od sehura do iftara',   desc: 'Drzi obavezni post od zore do zalaska sunca (Fard - Kuran 2:183)',                           priority: 'high', rec: 'daily' },
      { title: 'Sehur',                      desc: 'Ustani na sehur - "Jedite sehur jer je u sehuru bereket" (Buhari 1923)',                     priority: 'high', rec: 'daily' },
      { title: 'Iftar s hurmama',            desc: 'Iftari se hurmama i vodom po sunnetu (Abu Davud 2356)',                                      priority: 'high', rec: 'daily' },
      { title: 'Dova na iftaru',             desc: '"Zehebez-zama\' vebtelletil-uruk ve sebetel-edžru in ša Allah" (Abu Davud 2357)',             priority: 'high', rec: 'daily' },
      { title: 'Zekat ul-fitr',              desc: 'Izdvoj zekat ul-fitr prije bajram-namaza (Vadžib - Buhari 1503)',                             priority: 'high', rec: 'none' },

      // ─── Teravija i nocni ibadet ────────────────────────
      { title: 'Teravija namaz',             desc: 'Klanjaj teraviju poslije jacije (Sunnet muekked - Buhari 37)',                                priority: 'high', rec: 'daily' },
      { title: 'Hatma Kurana',               desc: 'Citaj barem 1 dzuz dnevno da zavrsis hatmu u Ramazanu (Buhari 4998)',                        priority: 'medium', rec: 'daily' },
      { title: 'Tehedzdzud / Kijamul-lejl',  desc: 'Nocni namaz u zadnjoj trecini noci - posebno vrijedan u Ramazanu (Kuran 17:79)',             priority: 'medium', rec: 'daily' },

      // ─── Ramazanske dove i zikr ─────────────────────────
      { title: 'Dova: Allahumme inneke afuvvun...', desc: '"Allahu moj, Ti prashtas i volis oprostiti, pa mi oprosti" - posebno za Lejletul-kadr (Tirmizi 3513)', priority: 'medium', rec: 'daily' },

      // ─── Sadaka i dobra djela ───────────────────────────
      { title: 'Sadaka / dobro djelo',       desc: 'Poslanik je bio najdarezljiviji u Ramazanu (Buhari 6, Muslim 2308)',                         priority: 'medium', rec: 'daily' },
      { title: 'Nahrani nekoga iftarom',     desc: '"Ko priredi iftar postaczu, ima istu nagradu" (Tirmizi 807)',                                priority: 'medium', rec: 'none' },

      // ─── Zadnjih 10 dana ────────────────────────────────
      { title: 'Itikaf (zadnjih 10 dana)',   desc: 'Povuci se u dzamiju zadnjih 10 dana Ramazana (Sunnet - Buhari 2025)',                        priority: 'low', rec: 'none' },
      { title: 'Trazi Lejletul-kadr',        desc: 'Posebno u neparnim nocima zadnjih 10 dana - bolja od 1000 mjeseci (Kuran 97:1-5, Buhari 2020)', priority: 'low', rec: 'none' },
      { title: 'Pojacaj ibadet zadnjih 10',  desc: 'Poslanik je pojacavao ibadet u zadnjih 10 noci i budio porodicu (Buhari 2024)',              priority: 'low', rec: 'daily' },

      // ─── Bajram priprema ────────────────────────────────
      { title: 'Priprema za Bajram',         desc: 'Kupovina poklona, cistoca, priprema za Ramazanski bajram',                                   priority: 'low', rec: 'none' },
    ];

    for (const t of tasks) {
      await client.query(
        `INSERT INTO tasks (id, user_id, project_id, title, description, status, priority, recurrence, task_type)
         VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, 'per_member')`,
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

export const uid = () => randomUUID();
export { pool, initDB };
export default pool;
