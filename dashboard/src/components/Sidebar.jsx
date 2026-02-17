import { useState, useEffect } from 'react';
import { IconGrid, IconCheck, IconFile, IconBarChart, IconUsers, IconRadio } from './Icons';
import { useTranslation } from '../i18n';
import { resolveAvatarUrl } from '../avatarUtils';
import { getProjectStatus } from '../projectStatus';
import { DB } from '../db';

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconCommunity() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconDatabase() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconChevron({ open }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

const TYPE_ICONS = {
  tweet_reaction: '\u2764\uFE0F',
  tweet_comment: '\uD83D\uDCAC',
  task_created: '\u2795',
  task_completed: '\u2705',
  task_status: '\uD83D\uDD04',
  project_join: '\uD83D\uDC4B',
  project_leave: '\uD83D\uDEAA',
  project_invite: '\uD83D\uDCE8',
  project_removed: '\u274C',
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Sidebar({ view, currentProjectId, projects, tasks, user, onNavigate, onNavigateProject, onNewProject, onImportProject, onLogout, mobileOpen, onCloseMobile }) {
  const { t } = useTranslation();
  const openCount = (pid) => tasks.filter(t => t.projectId === pid && t.status !== 'done').length;

  // Accordion state
  const [accordionOpen, setAccordionOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_accordions');
      return saved ? JSON.parse(saved) : { tasks: true, projects: true, notifications: false };
    } catch {
      return { tasks: true, projects: true, notifications: false };
    }
  });

  const toggleAccordion = (key) => {
    setAccordionOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('sidebar_accordions', JSON.stringify(next));
      return next;
    });
  };

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    try {
      const data = await DB.getNotifications();
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.isRead).length);
    } catch {
      // ignore
    }
  };

  const loadUnread = async () => {
    try {
      const { count } = await DB.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load full list when accordion opens
  useEffect(() => {
    if (accordionOpen.notifications) loadNotifications();
  }, [accordionOpen.notifications]);

  const handleMarkAllRead = async () => {
    await DB.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await DB.markNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (notif.targetType === 'tweet') {
      nav('community');
    } else if (notif.targetType === 'project') {
      navProject(notif.targetId);
    } else if (notif.targetType === 'task') {
      nav('tasks');
    }
  };

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  );
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    const onInstalled = () => setIsInstalled(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === 'accepted') setIsInstalled(true);
    }
  };

  const nav = (v) => {
    onNavigate(v);
    if (onCloseMobile) onCloseMobile();
  };

  const navProject = (id) => {
    onNavigateProject(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
      <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <IconGrid />
          Dashboard
        </div>

        {/* Tasks section - accordion */}
        <button className="sidebar-accordion-toggle" onClick={() => toggleAccordion('tasks')}>
          <IconChevron open={accordionOpen.tasks} />
          <span>{t('sidebar.tasks')}</span>
        </button>
        {accordionOpen.tasks && (
          <ul className="sidebar-nav">
            <li>
              <a
                href="#"
                className={view === 'tasks' ? 'active' : ''}
                onClick={(e) => { e.preventDefault(); nav('tasks'); }}
              >
                <IconCheck />
                {t('tasks.allTasks')}
              </a>
            </li>
            <li>
              <a
                href="#"
                className={view === 'calendar' ? 'active' : ''}
                onClick={(e) => { e.preventDefault(); nav('calendar'); }}
              >
                <IconCalendar />
                {t('sidebar.calendar')}
              </a>
            </li>
            <li>
              <a
                href="#"
                className={view === 'notes' ? 'active' : ''}
                onClick={(e) => { e.preventDefault(); nav('notes'); }}
              >
                <IconFile />
                {t('sidebar.notes')}
              </a>
            </li>
            <li>
              <a
                href="#"
                className={view === 'community' ? 'active' : ''}
                onClick={(e) => { e.preventDefault(); nav('community'); }}
              >
                <IconCommunity />
                {t('sidebar.community')}
              </a>
            </li>
            <li>
              <a
                href="#"
                className={view === 'users' ? 'active' : ''}
                onClick={(e) => { e.preventDefault(); nav('users'); }}
              >
                <IconUsers />
                {t('community.users')}
              </a>
            </li>
            <li>
              <a
                href="#"
                className={view === 'radio' ? 'active' : ''}
                onClick={(e) => { e.preventDefault(); nav('radio'); }}
              >
                <IconRadio />
                Radio
              </a>
            </li>
          </ul>
        )}

        {user?.username?.toLowerCase() === 'kamer' && (
          <>
            <button className="sidebar-accordion-toggle" onClick={() => toggleAccordion('custom')}>
              <IconChevron open={accordionOpen.custom} />
              <span>Custom Data</span>
            </button>
            {accordionOpen.custom && (
              <ul className="sidebar-nav">
                <li>
                  <a
                    href="#"
                    className={view === 'performance' ? 'active' : ''}
                    onClick={(e) => { e.preventDefault(); nav('performance'); }}
                  >
                    <IconBarChart />
                    {t('sidebar.performance')}
                  </a>
                </li>
              </ul>
            )}
          </>
        )}

        {/* Projects section - accordion */}
        <button className="sidebar-accordion-toggle" onClick={() => toggleAccordion('projects')}>
          <IconChevron open={accordionOpen.projects} />
          <span>{t('sidebar.projects')}</span>
        </button>
        {accordionOpen.projects && (
          <>
            <ul className="sidebar-nav">
              {projects.map((project) => {
                const pStatus = getProjectStatus(project);
                return (
                  <li key={project.id}>
                    <button
                      className={view === 'project' && currentProjectId === project.id ? 'active' : ''}
                      onClick={() => navProject(project.id)}
                    >
                      <span className={`project-dot${pStatus === 'completed' ? ' project-dot-completed' : ''}`} style={{ background: project.color }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: pStatus === 'completed' ? 0.6 : 1 }}>
                        {project.name}
                      </span>
                      {pStatus === 'completed' && <span className="sidebar-status-icon" title={t('projectStatus.completed')}>&#10003;</span>}
                      {project.memberCount > 1 && (
                        <span className="shared-badge" title={t('projects.share')}>
                          <IconUsers />
                        </span>
                      )}
                      <span className="project-badge">{openCount(project.id)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="sidebar-btn-row">
              <button className="sidebar-btn" onClick={() => { onNewProject(); if (onCloseMobile) onCloseMobile(); }}>+ {t('projects.newProject')}</button>
              <button className="sidebar-btn sidebar-btn-import" onClick={() => { onImportProject(); if (onCloseMobile) onCloseMobile(); }} title="Importuj projekat iz JSON-a">
                <IconUpload />
              </button>
            </div>
          </>
        )}

        {/* Notifications section - accordion */}
        <button className="sidebar-accordion-toggle" onClick={() => toggleAccordion('notifications')}>
          <IconChevron open={accordionOpen.notifications} />
          <IconBell />
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="sidebar-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>
        {accordionOpen.notifications && (
          <div className="sidebar-notif-list">
            {unreadCount > 0 && (
              <button className="sidebar-notif-mark-all" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
            {notifications.length === 0 && (
              <div className="sidebar-notif-empty">No notifications yet</div>
            )}
            {notifications.slice(0, 20).map((n) => (
              <div
                key={n.id}
                className={`sidebar-notif-item${n.isRead ? '' : ' unread'}`}
                onClick={() => handleNotificationClick(n)}
              >
                <span className="sidebar-notif-icon">
                  {TYPE_ICONS[n.type] || '\uD83D\uDD14'}
                </span>
                <div className="sidebar-notif-body">
                  <span className="sidebar-notif-summary">{n.summary}</span>
                  <span className="sidebar-notif-time">{timeAgo(n.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isInstalled && installPrompt && (
          <button className="sidebar-install-btn" onClick={handleInstall}>
            <IconDownload /> Install App
          </button>
        )}

        {user && (
          <div className="user-menu">
            <div className="user-menu-info" style={{ cursor: 'pointer' }} onClick={() => nav('profile')}>
              {resolveAvatarUrl(user.avatarUrl) ? (
                <img src={resolveAvatarUrl(user.avatarUrl)} alt="" className="user-menu-avatar" />
              ) : (
                <span className="user-menu-avatar-placeholder">{user.username?.charAt(0).toUpperCase()}</span>
              )}
              <span className="user-menu-name">{user.username}</span>
            </div>
            <button className="user-menu-logout" onClick={onLogout}>{t('auth.logout')}</button>
          </div>
        )}
      </aside>
    </>
  );
}
