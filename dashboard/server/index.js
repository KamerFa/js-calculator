import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './db.js';
import { authMiddleware } from './auth.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import noteRoutes from './routes/notes.js';
import tweetRoutes from './routes/tweets.js';
import communityRoutes from './routes/community.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Public routes (login/register) ──────────────────────────
app.use('/api/auth', authRoutes);

// ── Protected routes ────────────────────────────────────────
app.use('/api/projects', authMiddleware, projectRoutes);
app.use('/api/tasks', authMiddleware, taskRoutes);
app.use('/api/notes', authMiddleware, noteRoutes);
app.use('/api/tweets', authMiddleware, tweetRoutes);
app.use('/api/community', authMiddleware, communityRoutes);

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
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
