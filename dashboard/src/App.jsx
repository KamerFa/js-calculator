import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router';
import { useAuth } from './context/AuthContext';
import { useData } from './context/DataContext';
import { useModals } from './context/ModalContext';
import { DB } from './db';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import ModalHost from './components/ModalHost';
import radioAudio from './radioAudio';
import FocusTimer from './components/FocusTimer';
import BottomTabBar from './components/BottomTabBar';
import { timeAgo } from './utils/time';

// ── Pages (eagerly loaded core routes) ──
import TasksPage from './pages/TasksPage';
import ProjectPage from './pages/ProjectPage';
import CalendarPage from './pages/CalendarPage';

// ── Pages (lazy-loaded secondary routes) ──
const NotesPage = lazy(() => import('./pages/NotesPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const RadioPage = lazy(() => import('./pages/RadioPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));

// ── Radio mini player ────────────────────────────────────
function useRadioState() {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    return radioAudio.subscribe(() => forceUpdate((n) => n + 1));
  }, []);
  return {
    playing: radioAudio.getStation(),
    volume: radioAudio.getVolume(),
  };
}

function RadioMiniPlayer() {
  const { playing, volume } = useRadioState();
  const navigate = useNavigate();
  const isPaused = radioAudio.isPaused();
  const position = radioAudio.getPlayerPosition();
  if (!playing) return null;

  return (
    <div className={`radio-mini-player${isPaused ? ' radio-mini-paused' : ''}${position === 'top-bar' ? ' radio-mini-top' : ''}`} onClick={() => navigate('/radio')}>
      {!isPaused && (
        <div className="radio-now-eq">
          <span /><span /><span /><span />
        </div>
      )}
      <button
        className="radio-mini-playpause-btn"
        onClick={(e) => { e.stopPropagation(); isPaused ? radioAudio.resume() : radioAudio.pause(); }}
        title={isPaused ? 'Resume' : 'Pause'}
      >
        {isPaused
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
        }
      </button>
      <div className="radio-mini-info">
        <span className="radio-mini-name">{playing.name}</span>
        <span className="radio-mini-genre">{isPaused ? 'Paused' : playing.genre}</span>
      </div>
      <input
        type="range"
        className="radio-volume"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => { e.stopPropagation(); radioAudio.setVolume(e.target.value); }}
        title={`${Math.round(volume * 100)}%`}
      />
      <button className="radio-stop-btn" onClick={(e) => { e.stopPropagation(); radioAudio.stop(); }} title="Stop">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
      </button>
    </div>
  );
}

// ── Notification bell (top-right floating) ───────────────
const NOTIF_ICONS = {
  tweet_reaction: '\u2764\uFE0F',
  tweet_comment: '\uD83D\uDCAC',
  task_created: '\u2728',
  task_completed: '\uD83C\uDF1F',
  task_status: '\uD83C\uDF3F',
  task_reminder: '\u23F0',
  task_overdue: '\u26A0\uFE0F',
  streak_milestone: '\uD83D\uDD25',
  project_join: '\uD83C\uDF3B',
  project_leave: '\uD83C\uDF43',
  project_invite: '\uD83D\uDC8C',
  project_removed: '\uD83C\uDF42',
  comment_upvote: '\uD83D\uDC4D',
  friend_request: '\uD83E\uDD1D',
  friend_accepted: '\uD83C\uDF89',
  profile_comment: '\uD83D\uDCDD',
  message_reaction: '\u2764\uFE0F',
  direct_message: '\uD83D\uDCAC',
};

const NOTIF_FILTER_CATEGORIES = {
  all: () => true,
  tasks: (n) => ['task_created', 'task_completed', 'task_status', 'task_reminder', 'task_overdue', 'streak_milestone'].includes(n.type),
  social: (n) => ['tweet_reaction', 'tweet_comment', 'comment_upvote', 'friend_request', 'friend_accepted', 'profile_comment', 'message_reaction', 'direct_message'].includes(n.type),
  projects: (n) => ['project_join', 'project_leave', 'project_invite', 'project_removed'].includes(n.type),
};

const notifTimeAgo = timeAgo;

function getDateGroup(iso) {
  const now = new Date();
  const d = new Date(iso);
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const dateStr = d.toISOString().split('T')[0];

  if (dateStr === today) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';
  const diffDays = (now - d) / 86400000;
  if (diffDays < 7) return 'This Week';
  return 'Older';
}

function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifFilter, setNotifFilter] = useState('all');
  const panelRef = useRef(null);
  const bellRef = useRef(null);

  const loadNotifications = async () => {
    try {
      const data = await DB.getNotifications();
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.isRead).length);
    } catch { /* ignore */ }
  };

  const loadUnread = async () => {
    try {
      const { count } = await DB.getUnreadCount();
      setUnreadCount(count);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkAllRead = async () => {
    await DB.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleDismiss = async (e, notif) => {
    e.stopPropagation();
    await DB.deleteNotification(notif.id);
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    if (!notif.isRead) setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleClick = async (notif) => {
    if (!notif.isRead) {
      await DB.markNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (notif.targetType === 'tweet') navigate('/community');
    else if (notif.targetType === 'project') navigate(`/project/${notif.targetId}`);
    else if (notif.targetType === 'profile') {
      if (notif.type === 'profile_comment') navigate('/profile');
      else navigate(`/profile/${notif.actorName}`);
    }
    else if (notif.targetType === 'task') navigate('/');
    else if (notif.targetType === 'message' || notif.type === 'direct_message')
      navigate(notif.targetId ? `/messages/${notif.targetId}` : '/messages');
    else if (notif.type === 'message_reaction') navigate('/messages');
    else if (notif.type === 'friend_request' || notif.type === 'friend_accepted')
      navigate(notif.actorName ? `/profile/${notif.actorName}` : '/profile');
    else navigate('/');
  };

  const filteredNotifs = notifications.filter(NOTIF_FILTER_CATEGORIES[notifFilter] || (() => true));

  // Group notifications by date
  const groups = [];
  let lastGroup = null;
  for (const n of filteredNotifs.slice(0, 30)) {
    const group = getDateGroup(n.createdAt);
    if (group !== lastGroup) {
      groups.push({ label: group, items: [] });
      lastGroup = group;
    }
    groups[groups.length - 1].items.push(n);
  }

  return (
    <div className="notif-float">
      <button
        ref={bellRef}
        className={`notif-bell-btn${open ? ' notif-bell-open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div ref={panelRef} className="notif-panel">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>
            {unreadCount > 0 && (
              <button className="notif-panel-clear" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-filter-tabs">
            {['all', 'tasks', 'social', 'projects'].map((f) => (
              <button
                key={f}
                className={`notif-filter-tab${notifFilter === f ? ' active' : ''}`}
                onClick={() => setNotifFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="notif-panel-list">
            {filteredNotifs.length === 0 && (
              <div className="notif-panel-empty">
                <span className="notif-panel-empty-icon">{'\uD83C\uDF3F'}</span>
                <span>All caught up. Enjoy the calm.</span>
              </div>
            )}
            {groups.map((g) => (
              <div key={g.label}>
                <div className="notif-date-group">{g.label}</div>
                {g.items.map((n) => (
                  <div
                    key={n.id}
                    className={`notif-panel-item${n.isRead ? '' : ' notif-unread'}`}
                    onClick={() => handleClick(n)}
                  >
                    <span className="notif-panel-icon">
                      {NOTIF_ICONS[n.type] || '\uD83C\uDF3F'}
                    </span>
                    <div className="notif-panel-body">
                      <span className="notif-panel-summary">{n.summary}</span>
                      <span className="notif-panel-time">{notifTimeAgo(n.createdAt)}</span>
                    </div>
                    <button
                      className="notif-dismiss-btn"
                      onClick={(e) => handleDismiss(e, n)}
                      title="Dismiss"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── App shell ────────────────────────────────────────────
export default function App() {
  const { user, authChecked, handleAuth, logout } = useAuth();
  const { projects, tasks } = useData();
  const { openProjectModal, openImportModal } = useModals();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!authChecked) return null;

  if (!user) {
    return <LoginPage onAuth={handleAuth} />;
  }

  const isRadioPage = location.pathname === '/radio';

  return (
    <div className="app-layout">
      <Sidebar
        projects={projects}
        tasks={tasks}
        user={user}
        onNewProject={() => openProjectModal()}
        onImportProject={() => openImportModal()}
        onLogout={logout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main className="main" onClick={() => mobileOpen && setMobileOpen(false)}>
        <Suspense fallback={<div className="page-container"><div className="empty-state">Loading...</div></div>}>
          <Routes>
            <Route index element={<TasksPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="community" element={<CommunityPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="radio" element={<RadioPage />} />
            <Route path="news" element={<NewsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/:username" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="project/:id" element={<ProjectPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="messages/:userId" element={<MessagesPage />} />
          </Routes>
        </Suspense>

        {!isRadioPage && <RadioMiniPlayer />}
        <FocusTimer />
        <NotificationBell />
      </main>

      <BottomTabBar
        onOpenSidebar={() => setMobileOpen(true)}
        onLogout={logout}
      />

      <ModalHost />
    </div>
  );
}
