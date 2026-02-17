import { Router } from 'express';
import pool, { uid } from '../db.js';
import { notify, getUsername } from '../notify.js';

const router = Router();

function toDateStr(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function toJSON(row, extra = {}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    isPublic: row.is_public || false,
    isGlobal: row.is_global || false,
    startDate: toDateStr(row.start_date),
    endDate: toDateStr(row.end_date),
    createdAt: row.created_at,
    ownerId: row.user_id,
    ...extra,
  };
}

// ── GET all projects (owned + shared) ────────────────────────
router.get('/', async (req, res) => {
  const { rows: owned } = await pool.query(
    `SELECT p.*, (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count
     FROM projects p WHERE p.user_id = $1 ORDER BY p.created_at`,
    [req.userId]
  );
  const { rows: shared } = await pool.query(
    `SELECT p.*, pm.role,
            (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id) AS member_count
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id
     WHERE pm.user_id = $1 AND p.user_id != $1
     ORDER BY p.created_at`,
    [req.userId]
  );

  const result = [
    ...owned.map((r) => toJSON(r, { isOwner: true, memberCount: parseInt(r.member_count) })),
    ...shared.map((r) => toJSON(r, { isOwner: r.role === 'owner', role: r.role, memberCount: parseInt(r.member_count) })),
  ];
  res.json(result);
});

// ── POST create/update project ───────────────────────────────
router.post('/', async (req, res) => {
  const { name, description, color, isPublic, startDate, endDate } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  const id = req.body.id || uid();
  const pub = isPublic ? true : false;
  const { rows: existingRows } = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
  const existing = existingRows[0];

  if (existing) {
    if (existing.user_id !== req.userId) {
      return res.status(403).json({ error: 'Only the project owner can edit' });
    }
    await pool.query(
      'UPDATE projects SET name = $1, description = $2, color = $3, is_public = $4, start_date = $5, end_date = $6 WHERE id = $7 AND user_id = $8',
      [name.trim(), description || '', color || '#2a5caa', pub, startDate || null, endDate || null, id, req.userId]
    );
  } else {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO projects (id, user_id, name, description, color, is_public, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [id, req.userId, name.trim(), description || '', color || '#2a5caa', pub, startDate || null, endDate || null]
      );
      await client.query(
        'INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, $4)',
        [uid(), id, req.userId, 'owner']
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  const { rows } = await pool.query(
    `SELECT p.*, (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count
     FROM projects p WHERE p.id = $1`,
    [id]
  );
  res.json(toJSON(rows[0], { isOwner: true, memberCount: parseInt(rows[0].member_count) }));
});

// ── DELETE project (owner only) ──────────────────────────────
router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.json({ ok: true });
  if (rows[0].user_id !== req.userId) {
    return res.status(403).json({ error: 'Only the project owner can delete' });
  }
  await pool.query('DELETE FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
});

// ── GET project members ──────────────────────────────────────
router.get('/:id/members', async (req, res) => {
  const { rows: projectRows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  if (!projectRows[0]) return res.status(404).json({ error: 'Project not found' });

  const project = projectRows[0];
  const { rows: memberCheck } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );
  if (project.user_id !== req.userId && memberCheck.length === 0) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { rows: members } = await pool.query(
    `SELECT pm.*, u.username FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY pm.role DESC, pm.joined_at`,
    [req.params.id]
  );

  // Shared task stats: count completions per completer (not creator)
  const totalSharedTasks = await pool.query(
    `SELECT COUNT(*) as total FROM tasks WHERE project_id = $1 AND task_type = 'shared'`,
    [req.params.id]
  );
  const sharedTotal = parseInt(totalSharedTasks.rows[0]?.total || 0);
  const { rows: sharedStats } = await pool.query(
    `SELECT completed_by as user_id, COUNT(*) as done
     FROM tasks WHERE project_id = $1 AND task_type = 'shared' AND status = 'done' AND completed_by IS NOT NULL
     GROUP BY completed_by`,
    [req.params.id]
  );

  // Per-member task stats (each member gets the full per_member task count)
  const { rows: perMemberStats } = await pool.query(
    `SELECT pm.user_id,
            (SELECT COUNT(*) FROM tasks WHERE project_id = $1 AND task_type = 'per_member') as total,
            (SELECT COUNT(*) FROM task_completions tc
             JOIN tasks t ON t.id = tc.task_id
             WHERE t.project_id = $1 AND t.task_type = 'per_member' AND tc.user_id = pm.user_id) as done
     FROM project_members pm WHERE pm.project_id = $1`,
    [req.params.id]
  );

  const statsMap = {};
  for (const s of sharedStats) {
    statsMap[s.user_id] = { total: sharedTotal, done: parseInt(s.done) };
  }
  for (const s of perMemberStats) {
    if (!statsMap[s.user_id]) statsMap[s.user_id] = { total: 0, done: 0 };
    statsMap[s.user_id].total += parseInt(s.total);
    statsMap[s.user_id].done += parseInt(s.done);
  }

  res.json(members.map((m) => ({
    userId: m.user_id,
    username: m.username,
    role: m.role,
    joinedAt: m.joined_at,
    tasks: statsMap[m.user_id] || { total: 0, done: 0 },
  })));
});

// ── POST add member to project ───────────────────────────────
router.post('/:id/members', async (req, res) => {
  const { rows: projectRows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  if (!projectRows[0]) return res.status(404).json({ error: 'Project not found' });
  if (projectRows[0].user_id !== req.userId) {
    return res.status(403).json({ error: 'Only the project owner can add members' });
  }

  const { username } = req.body;
  if (!username?.trim()) return res.status(400).json({ error: 'Username required' });

  const { rows: userRows } = await pool.query(
    'SELECT id, username FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]
  );
  if (!userRows[0]) return res.status(404).json({ error: 'User not found' });

  const targetUser = userRows[0];
  if (targetUser.id === req.userId) {
    return res.status(400).json({ error: 'You are already the owner' });
  }

  const { rows: existingMember } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [req.params.id, targetUser.id]
  );
  if (existingMember.length > 0) return res.status(409).json({ error: 'User is already a member' });

  await pool.query(
    'INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [uid(), req.params.id, targetUser.id, 'member']
  );

  // Notify the invited user
  const actor = await getUsername(req.userId);
  const project = projectRows[0];
  await notify(targetUser.id, req.userId, 'project_invite',
    `${actor} added you to "${project.name}"`, 'project', req.params.id);

  res.json({ ok: true, username: targetUser.username, userId: targetUser.id });
});

// ── DELETE remove member from project ────────────────────────
router.delete('/:id/members/:userId', async (req, res) => {
  const { rows: projectRows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  if (!projectRows[0]) return res.status(404).json({ error: 'Project not found' });

  const project = projectRows[0];
  if (project.user_id !== req.userId && req.params.userId !== req.userId) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  if (req.params.userId === project.user_id) {
    return res.status(400).json({ error: 'Cannot remove the project owner' });
  }

  await pool.query(
    'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
    [req.params.id, req.params.userId]
  );

  // Notify the removed user (if removed by owner, not self-removal)
  if (req.params.userId !== req.userId) {
    await notify(req.params.userId, req.userId, 'project_removed',
      `You were removed from "${project.name}"`, 'project', req.params.id);
  }

  res.json({ ok: true });
});

// ── GET project stats (task completion history) ──────────────
router.get('/:id/stats', async (req, res) => {
  const { rows: projectRows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  if (!projectRows[0]) return res.status(404).json({ error: 'Project not found' });

  const project = projectRows[0];
  const { rows: memberCheck } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );
  if (project.user_id !== req.userId && memberCheck.length === 0) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Get shared task completions
  const { rows: sharedCompletions } = await pool.query(
    `SELECT DATE(completed_at) as date, COUNT(*) as count
     FROM tasks
     WHERE project_id = $1 AND task_type = 'shared' AND status = 'done' AND completed_at IS NOT NULL
     GROUP BY DATE(completed_at)
     ORDER BY date`,
    [req.params.id]
  );

  // Get per-member task completions
  const { rows: perMemberCompletions } = await pool.query(
    `SELECT DATE(tc.completed_at) as date, COUNT(*) as count
     FROM task_completions tc
     JOIN tasks t ON t.id = tc.task_id
     WHERE t.project_id = $1 AND t.task_type = 'per_member'
     GROUP BY DATE(tc.completed_at)
     ORDER BY date`,
    [req.params.id]
  );

  // Merge both completion types by date
  const completionMap = {};
  for (const row of sharedCompletions) {
    const dateStr = row.date.toISOString().split('T')[0];
    completionMap[dateStr] = (completionMap[dateStr] || 0) + parseInt(row.count);
  }
  for (const row of perMemberCompletions) {
    const dateStr = row.date.toISOString().split('T')[0];
    completionMap[dateStr] = (completionMap[dateStr] || 0) + parseInt(row.count);
  }

  const completions = Object.entries(completionMap).map(([date, count]) => ({ date, count }));
  completions.sort((a, b) => a.date.localeCompare(b.date));

  res.json({ completions });
});

// ── POST import project from JSON (project + tasks in one go) ──
router.post('/import', async (req, res) => {
  const { name, description, color, isPublic, startDate, endDate, tasks } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Project name is required' });
  if (!Array.isArray(tasks) || tasks.length === 0) return res.status(400).json({ error: 'At least one task is required' });
  if (tasks.length > 100) return res.status(400).json({ error: 'Maximum 100 tasks per import' });

  const projectId = uid();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO projects (id, user_id, name, description, color, is_public, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [projectId, req.userId, name.trim(), description || '', color || '#2a5caa', isPublic ? true : false, startDate || null, endDate || null]
    );

    await client.query(
      `INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, 'owner')`,
      [uid(), projectId, req.userId]
    );

    for (const t of tasks) {
      if (!t.title?.trim()) continue;
      const rec = ['daily', 'weekly', 'monthly', 'none'].includes(t.recurrence) ? t.recurrence : 'none';
      const pri = ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium';
      await client.query(
        `INSERT INTO tasks (id, user_id, project_id, title, description, status, priority, due_date, recurrence, task_type)
         VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, $8, $9)`,
        [uid(), req.userId, projectId, t.title.trim(), t.description || '', pri, t.dueDate || null, rec, t.taskType || 'shared']
      );
    }

    await client.query('COMMIT');

    const { rows } = await pool.query(
      `SELECT p.*, (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count
       FROM projects p WHERE p.id = $1`,
      [projectId]
    );
    res.json(toJSON(rows[0], { isOwner: true, memberCount: parseInt(rows[0].member_count), taskCount: tasks.length }));
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Import error:', e.message);
    res.status(500).json({ error: 'Import failed: ' + e.message });
  } finally {
    client.release();
  }
});

export default router;
