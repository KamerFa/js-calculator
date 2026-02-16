import { Router } from 'express';
import db, { uid } from '../db.js';

const router = Router();

const allForUser = db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC');
const findOne = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?');
const insert = db.prepare(
  'INSERT INTO notes (id, user_id, title, body, attached_to) VALUES (?, ?, ?, ?, ?)'
);
const update = db.prepare(
  'UPDATE notes SET title = ?, body = ?, attached_to = ?, updated_at = datetime(\'now\') WHERE id = ? AND user_id = ?'
);
const remove = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?');
const clearAttachment = db.prepare(
  `UPDATE notes SET attached_to = NULL, updated_at = datetime('now')
   WHERE user_id = ? AND json_extract(attached_to, '$.type') = ? AND json_extract(attached_to, '$.id') = ?`
);

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

router.get('/', (req, res) => {
  const rows = allForUser.all(req.userId);
  res.json(rows.map(toJSON));
});

router.post('/', (req, res) => {
  const { title, body, attachedTo } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

  const id = req.body.id || uid();
  const at = attachedTo ? JSON.stringify(attachedTo) : null;
  const existing = findOne.get(id, req.userId);

  if (existing) {
    update.run(title.trim(), body || '', at, id, req.userId);
  } else {
    insert.run(id, req.userId, title.trim(), body || '', at);
  }

  const row = findOne.get(id, req.userId);
  res.json(toJSON(row));
});

router.delete('/:id', (req, res) => {
  remove.run(req.params.id, req.userId);
  res.json({ ok: true });
});

// Clear attachments when a project is deleted
router.post('/clear-attachment', (req, res) => {
  const { type, id } = req.body;
  if (!type || !id) return res.status(400).json({ error: 'type and id required' });
  clearAttachment.run(req.userId, type, id);
  res.json({ ok: true });
});

export default router;
