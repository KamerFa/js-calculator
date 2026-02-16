import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { uid } from '../db.js';
import { signToken, authMiddleware } from '../auth.js';

const router = Router();

const findUser = db.prepare('SELECT * FROM users WHERE username = ?');
const insertUser = db.prepare(
  'INSERT INTO users (id, username, password) VALUES (?, ?, ?)'
);

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const existing = findUser.get(username.trim());
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const hash = await bcrypt.hash(password, 10);
  const id = uid();
  insertUser.run(id, username.trim(), hash);

  // Seed demo data for new user
  seedDemoData(id);

  const token = signToken(id);
  res.json({ token, user: { id, username: username.trim() } });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = findUser.get(username.trim());
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, username: user.username } });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// ── Seed demo data for new users ─────────────────────────────
function seedDemoData(userId) {
  const insertProject = db.prepare(
    'INSERT INTO projects (id, user_id, name, description, color) VALUES (?, ?, ?, ?, ?)'
  );
  const insertTask = db.prepare(
    `INSERT INTO tasks (id, user_id, project_id, title, description, status, priority, due_date, custom_fields)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertNote = db.prepare(
    `INSERT INTO notes (id, user_id, title, body, attached_to)
     VALUES (?, ?, ?, ?, ?)`
  );

  const d = (offset) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offset);
    return dt.toISOString().slice(0, 10);
  };

  const pid1 = uid(), pid2 = uid(), pid3 = uid(), pidWellness = uid();

  const seedAll = db.transaction(() => {
    // Projects
    insertProject.run(pidWellness, userId, 'Daily Wellness', 'Daily health, hygiene, nutrition, and self-care tracker.', '#0891b2');
    insertProject.run(pid1, userId, 'Website Redesign', 'Overhaul the company marketing site with new brand guidelines.', '#2a5caa');
    insertProject.run(pid2, userId, 'Mobile App MVP', 'Build and launch v1 of the iOS/Android app.', '#7c3aed');
    insertProject.run(pid3, userId, 'Q3 Marketing', 'Plan and execute Q3 marketing campaigns.', '#059669');

    // Tasks
    const tasks = [
      [pid1, 'Create wireframes for homepage', 'Low-fi wireframes in Figma covering hero, features, testimonials, footer.', 'done', 'high', d(-3)],
      [pid1, 'Design system — colour palette & typography', '', 'done', 'high', d(-5)],
      [pid1, 'Build responsive nav component', 'Hamburger on mobile, sticky on scroll.', 'in-progress', 'medium', d(2)],
      [pid1, 'Implement hero section', '', 'todo', 'high', d(4)],
      [pid1, 'SEO audit & meta tags', 'Run Lighthouse, fix issues.', 'todo', 'low', d(10)],
      [pid2, 'Set up React Native project', 'Expo managed workflow.', 'done', 'high', d(-7)],
      [pid2, 'Auth flow — login / signup screens', '', 'in-progress', 'high', d(1)],
      [pid2, 'API integration layer', 'Axios + React Query.', 'todo', 'medium', d(5)],
      [pid2, 'Push notifications', '', 'todo', 'low', d(14)],
      [pid3, 'Draft Q3 content calendar', '', 'in-progress', 'high', d(0)],
      [pid3, 'Design social media templates', 'Canva / Figma.', 'todo', 'medium', d(6)],
      [pid3, 'Newsletter copy for July', '', 'todo', 'medium', d(8)],
    ];
    for (const [projId, title, desc, status, priority, due] of tasks) {
      insertTask.run(uid(), userId, projId, title, desc, status, priority, due, '[]');
    }

    // Wellness tasks
    const wellnessTasks = [
      ['Drink water — morning (500ml)', 'First thing when you wake up.', 'high', 'Hydration'],
      ['Drink water — afternoon (500ml)', '', 'medium', 'Hydration'],
      ['Drink water — evening (500ml)', '', 'medium', 'Hydration'],
      ['Eat breakfast', 'Aim for protein + complex carbs.', 'high', 'Nutrition'],
      ['Eat lunch', '', 'high', 'Nutrition'],
      ['Eat dinner', '', 'high', 'Nutrition'],
      ['Take vitamins / supplements', '', 'low', 'Nutrition'],
      ['Brush teeth — morning', '', 'high', 'Hygiene'],
      ['Brush teeth — night', '', 'high', 'Hygiene'],
      ['Shower', '', 'medium', 'Hygiene'],
      ['Skincare routine', 'Cleanser, moisturiser, SPF (morning).', 'low', 'Hygiene'],
      ['Exercise / workout', 'At least 30 minutes of movement.', 'high', 'Exercise'],
      ['Stretch / mobility (10 min)', '', 'medium', 'Exercise'],
      ['Go outside — get sunlight', 'Even 15 minutes helps circadian rhythm.', 'medium', 'Exercise'],
      ['No screens 30 min before bed', '', 'medium', 'Mental Health'],
      ['Journal / reflect (5 min)', 'What went well today?', 'low', 'Mental Health'],
      ['Tidy up workspace', 'Clean desk = clear mind.', 'low', 'Mental Health'],
      ['In bed by target bedtime', 'Aim for 7-8 hours of sleep.', 'high', 'Sleep'],
    ];
    for (const [title, desc, priority, category] of wellnessTasks) {
      const cf = category ? JSON.stringify([{ key: 'Category', value: category }]) : '[]';
      insertTask.run(uid(), userId, pidWellness, title, desc, 'todo', priority, d(0), cf);
    }

    // Notes
    insertNote.run(uid(), userId, 'Design Inspiration', 'Collected links:\n- dribbble.com/shots/…\n- awwwards.com/…\n\nKeep the aesthetic minimal and typographic.', JSON.stringify({ type: 'project', id: pid1 }));
    insertNote.run(uid(), userId, 'App Store Guidelines Checklist', '- [ ] Screenshots (6.5" & 5.5")\n- [ ] Privacy policy URL\n- [ ] Age rating questionnaire\n- [ ] Build uploaded via Transporter', JSON.stringify({ type: 'project', id: pid2 }));
    insertNote.run(uid(), userId, 'Meeting Notes — Kickoff', 'Attendees: Sarah, James, Mo\n\nKey decisions:\n1. Launch target: Aug 15\n2. Budget approved for paid ads\n3. Influencer outreach starts July 1', null);
  });

  seedAll();
}

export default router;
