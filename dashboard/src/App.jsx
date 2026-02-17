import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router';
import { useAuth } from './context/AuthContext';
import { useData } from './context/DataContext';
import { useModals } from './context/ModalContext';
import { DB } from './db';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import ModalHost from './components/ModalHost';
import radioAudio from './radioAudio';

// ── Pages ────────────────────────────────────────────────
import TasksPage from './pages/TasksPage';
import ProjectPage from './pages/ProjectPage';
import CalendarPage from './pages/CalendarPage';
import NotesPage from './pages/NotesPage';
import CommunityPage from './pages/CommunityPage';
import ProfilePage from './pages/ProfilePage';
import UsersPage from './pages/UsersPage';
import RadioPage from './pages/RadioPage';

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
  if (!playing) return null;

  return (
    <div className="radio-mini-player" onClick={() => navigate('/radio')}>
      <div className="radio-now-eq">
        <span /><span /><span /><span />
      </div>
      <div className="radio-mini-info">
        <span className="radio-mini-name">{playing.name}</span>
        <span className="radio-mini-genre">{playing.genre}</span>
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
      <button className="radio-stop-btn" onClick={(e) => { e.stopPropagation(); radioAudio.stop(); }}>
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
  project_join: '\uD83C\uDF3B',
  project_leave: '\uD83C\uDF43',
  project_invite: '\uD83D\uDC8C',
  project_removed: '\uD83C\uDF42',
};

function notifTimeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
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
    else if (notif.targetType === 'task') navigate('/');
  };

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

          <div className="notif-panel-list">
            {notifications.length === 0 && (
              <div className="notif-panel-empty">
                <span className="notif-panel-empty-icon">{'\uD83C\uDF3F'}</span>
                <span>All caught up. Enjoy the calm.</span>
              </div>
            )}
            {notifications.slice(0, 30).map((n) => (
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
      {!mobileOpen && (
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

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
        <Routes>
          <Route index element={<TasksPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="community" element={<CommunityPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="radio" element={<RadioPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/:username" element={<ProfilePage />} />
          <Route path="project/:id" element={<ProjectPage />} />
        </Routes>

        {!isRadioPage && <RadioMiniPlayer />}
        <NotificationBell />
      </main>

      <ModalHost />
    </div>
  );
}
