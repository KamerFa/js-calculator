import { Router } from 'express';
import pool, { uid } from '../db.js';

const router = Router();

function toJSON(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    attachedTo: row.attached_to ? JSON.parse(row.attached_to) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC',
    [req.userId]
  );
  res.json(rows.map(toJSON));
});

router.post('/', async (req, res) => {
  const { title, body, attachedTo } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

  const id = req.body.id || uid();
  const at = attachedTo ? JSON.stringify(attachedTo) : null;

  const { rows: existingRows } = await pool.query(
    'SELECT * FROM notes WHERE id = $1 AND user_id = $2', [id, req.userId]
  );

  if (existingRows[0]) {
    await pool.query(
      'UPDATE notes SET title = $1, body = $2, attached_to = $3, updated_at = NOW() WHERE id = $4 AND user_id = $5',
      [title.trim(), body || '', at, id, req.userId]
    );
  } else {
    await pool.query(
      'INSERT INTO notes (id, user_id, title, body, attached_to) VALUES ($1, $2, $3, $4, $5)',
      [id, req.userId, title.trim(), body || '', at]
    );
  }

  const { rows } = await pool.query('SELECT * FROM notes WHERE id = $1 AND user_id = $2', [id, req.userId]);
  res.json(toJSON(rows[0]));
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM notes WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
});

// Clear attachments when a project/task is deleted
router.post('/clear-attachment', async (req, res) => {
  const { type, id } = req.body;
  if (!type || !id) return res.status(400).json({ error: 'type and id required' });
  await pool.query(
    `UPDATE notes SET attached_to = NULL, updated_at = NOW()
     WHERE user_id = $1 AND attached_to::jsonb->>'type' = $2 AND attached_to::jsonb->>'id' = $3`,
    [req.userId, type, id]
  );
  res.json({ ok: true });
});

export default router;
