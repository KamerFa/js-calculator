import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { initDB } from './db.js';
import { authMiddleware } from './auth.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import noteRoutes from './routes/notes.js';
import tweetRoutes from './routes/tweets.js';
import communityRoutes from './routes/community.js';
import profileRoutes from './routes/profile.js';
import usersRoutes from './routes/users.js';
import notificationRoutes from './routes/notifications.js';
import messageRoutes from './routes/messages.js';
import commentRoutes from './routes/comments.js';
import radioRoutes from './routes/radio.js';
import newsRoutes from './routes/news.js';
import pool from './db.js';
import { checkDueTaskReminders, checkOverdueTasks, checkStreakMilestones } from './scheduled.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Serve uploaded files ──────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// ── Public routes (login/register) ──────────────────────────
app.use('/api/auth', authRoutes);

// ── Protected routes ────────────────────────────────────────
app.use('/api/projects', authMiddleware, projectRoutes);
app.use('/api/tasks', authMiddleware, taskRoutes);
app.use('/api/notes', authMiddleware, noteRoutes);
app.use('/api/tweets', authMiddleware, tweetRoutes);
app.use('/api/community', authMiddleware, communityRoutes);
app.use('/api/profile', authMiddleware, profileRoutes);
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/comments', authMiddleware, commentRoutes);
app.use('/api/radio', authMiddleware, radioRoutes);
app.use('/api/news', authMiddleware, newsRoutes);

// ── File uploads (screenshots + avatars) ──────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.png';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only images are allowed'));
  },
});

app.post('/api/tasks/:id/screenshot', authMiddleware, upload.single('screenshot'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  await pool.query('UPDATE tasks SET screenshot_url = $1 WHERE id = $2', [url, req.params.id]);
  res.json({ screenshotUrl: url });
});

app.post('/api/profile/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [url, req.userId]);
  res.json({ avatarUrl: url });
});

// ── Serve frontend in production ────────────────────────────
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

// ── Initialize DB then start server ─────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Dashboard API running on http://localhost:${PORT}`);
    });

    // Run scheduled notification jobs every hour
    const runScheduledJobs = async () => {
      try {
        await checkDueTaskReminders();
        await checkOverdueTasks();
        await checkStreakMilestones();
      } catch (err) {
        console.error('Scheduled job error:', err.message);
      }
    };
    // Run once on startup, then every hour
    runScheduledJobs();
    setInterval(runScheduledJobs, 3600000);
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
