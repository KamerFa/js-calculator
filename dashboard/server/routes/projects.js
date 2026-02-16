import { Router } from 'express';
import db, { uid } from '../db.js';

const router = Router();

const allForUser = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at');
const findOne = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?');
const insert = db.prepare(
  'INSERT INTO projects (id, user_id, name, description, color) VALUES (?, ?, ?, ?, ?)'
);
const update = db.prepare(
  'UPDATE projects SET name = ?, description = ?, color = ? WHERE id = ? AND user_id = ?'
);
const remove = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?');

function toJSON(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    createdAt: row.created_at,
  };
}

router.get('/', (req, res) => {
  const rows = allForUser.all(req.userId);
  res.json(rows.map(toJSON));
});

router.post('/', (req, res) => {
  const { name, description, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  const id = req.body.id || uid();
  const existing = findOne.get(id, req.userId);

  if (existing) {
    update.run(name.trim(), description || '', color || '#2a5caa', id, req.userId);
  } else {
    insert.run(id, req.userId, name.trim(), description || '', color || '#2a5caa');
  }

  const row = findOne.get(id, req.userId);
  res.json(toJSON(row));
});

router.delete('/:id', (req, res) => {
  remove.run(req.params.id, req.userId);
  res.json({ ok: true });
});

export default router;
