import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { IconGrid, IconCheck, IconFile, IconUsers, IconRadio, IconNews, IconCalendar, IconCommunity } from './Icons';
import { useTranslation } from '../i18n';
import { resolveAvatarUrl } from '../avatarUtils';
import { getProjectStatus } from '../projectStatus';
import StatusDot, { CustomStatusBadge } from './StatusDot';
import StatusPicker from './StatusPicker';
import { DB } from '../db';

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

function IconSettings() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default function Sidebar({ projects, tasks, user, onNewProject, onImportProject, onLogout, mobileOpen, onCloseMobile }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [myStatus, setMyStatus] = useState({ presence: 'active', statusEmoji: null, statusText: null });
  const userMenuRef = useRef(null);

  // Load own status from profile
  useEffect(() => {
    if (!user) return;
    DB.getProfile().then((p) => {
      setMyStatus({
        presence: p.presence || 'active',
        statusEmoji: p.statusEmoji || null,
        statusText: p.statusText || null,
      });
    }).catch(() => {});
  }, [user]);
  const openCount = (pid) => tasks.filter(t => t.projectId === pid && t.status !== 'done').length;

  // Derive current view and project id from URL
  const pathname = location.pathname;
  const view = pathname === '/' ? 'tasks'
    : pathname.startsWith('/project/') ? 'project'
    : pathname.slice(1).split('/')[0] || 'tasks';
  const currentProjectId = pathname.startsWith('/project/') ? pathname.split('/')[2] : null;

  // Accordion state — only projects needs collapsing
  const [projectsOpen, setProjectsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_accordions');
      const parsed = saved ? JSON.parse(saved) : { projects: true };
      return parsed.projects !== false;
    } catch {
      return true;
    }
  });

  const toggleProjects = () => {
    setProjectsOpen((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_accordions', JSON.stringify({ projects: next }));
      return next;
    });
  };

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)
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

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const nav = (path) => {
    navigate(path);
    if (onCloseMobile) onCloseMobile();
  };

  const navProject = (id) => {
    navigate(`/project/${id}`);
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

        {/* ── Workspace section ── */}
        <div className="sidebar-section-label">{t('sidebar.workspace') || 'Workspace'}</div>
        <ul className="sidebar-nav">
          <li>
            <a
              href="/"
              className={view === 'tasks' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); nav('/'); }}
            >
              <IconCheck />
              {t('tasks.allTasks')}
            </a>
          </li>
          <li>
            <a
              href="/calendar"
              className={view === 'calendar' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); nav('/calendar'); }}
            >
              <IconCalendar />
              {t('sidebar.calendar')}
            </a>
          </li>
          <li>
            <a
              href="/notes"
              className={view === 'notes' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); nav('/notes'); }}
            >
              <IconFile />
              {t('sidebar.notes')}
            </a>
          </li>
        </ul>

        {/* ── Social section ── */}
        <div className="sidebar-section-label">{t('sidebar.social') || 'Social'}</div>
        <ul className="sidebar-nav">
          <li>
            <a
              href="/community"
              className={view === 'community' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); nav('/community'); }}
            >
              <IconCommunity />
              {t('sidebar.community')}
            </a>
          </li>
          <li>
            <a
              href="/users"
              className={view === 'users' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); nav('/users'); }}
            >
              <IconUsers />
              {t('community.users')}
            </a>
          </li>
          <li>
            <a
              href="/news"
              className={view === 'news' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); nav('/news'); }}
            >
              <IconNews />
              News
            </a>
          </li>
        </ul>

        {/* ── Media section ── */}
        <div className="sidebar-section-label">{t('sidebar.media') || 'Media'}</div>
        <ul className="sidebar-nav">
          <li>
            <a
              href="/radio"
              className={view === 'radio' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); nav('/radio'); }}
            >
              <IconRadio />
              Radio
            </a>
          </li>
        </ul>

        {/* ── Projects section — collapsible accordion ── */}
        <button className="sidebar-accordion-toggle" onClick={toggleProjects}>
          <IconChevron open={projectsOpen} />
          <span>{t('sidebar.projects')}</span>
        </button>
        {projectsOpen && (
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

        {!isInstalled && installPrompt && (
          <button className="sidebar-install-btn" onClick={handleInstall}>
            <IconDownload /> Install App
          </button>
        )}

        {user && (
          <div className="user-menu" ref={userMenuRef}>
            <div className="user-menu-info" style={{ cursor: 'pointer' }} onClick={() => setUserMenuOpen(!userMenuOpen)}>
              <span className="avatar-with-status">
                {resolveAvatarUrl(user.avatarUrl) ? (
                  <img src={resolveAvatarUrl(user.avatarUrl)} alt="" className="user-menu-avatar" />
                ) : (
                  <span className="user-menu-avatar-placeholder">{user.username?.charAt(0).toUpperCase()}</span>
                )}
                <StatusDot presence={myStatus.presence} size={10} statusEmoji={myStatus.statusEmoji} statusText={myStatus.statusText} style={{ position: 'absolute', bottom: -1, right: -1, border: '2px solid var(--sidebar-bg, var(--surface))', borderRadius: '50%', boxSizing: 'content-box' }} />
              </span>
              <span className="user-menu-name-col">
                <span className="user-menu-name">{user.username}</span>
                {(myStatus.statusEmoji || myStatus.statusText) && (
                  <span className="user-menu-status-text">
                    {myStatus.statusEmoji} {myStatus.statusText}
                  </span>
                )}
              </span>
            </div>
            {userMenuOpen && !statusPickerOpen && (
              <div className="user-menu-popup">
                <button
                  className="user-menu-popup-item"
                  onClick={() => { setStatusPickerOpen(true); }}
                >
                  <StatusDot presence={myStatus.presence} size={10} statusEmoji={myStatus.statusEmoji} statusText={myStatus.statusText} />
                  {myStatus.statusEmoji || myStatus.statusText
                    ? <span>{myStatus.statusEmoji} {myStatus.statusText}</span>
                    : <span>Set a status</span>
                  }
                </button>
                <div className="user-menu-popup-divider" />
                <button className="user-menu-popup-item" onClick={() => { nav('/profile'); setUserMenuOpen(false); }}>
                  <IconUser /> {t('profile.title')}
                </button>
                <button className="user-menu-popup-item" onClick={() => { nav('/settings'); setUserMenuOpen(false); }}>
                  <IconSettings /> {t('settings.title') || 'Settings'}
                </button>
                <div className="user-menu-popup-divider" />
                <button className="user-menu-popup-item user-menu-popup-danger" onClick={onLogout}>
                  <IconLogout /> {t('auth.logout')}
                </button>
              </div>
            )}
            {statusPickerOpen && (
              <StatusPicker
                currentPresence={myStatus.presence}
                currentStatus={{ emoji: myStatus.statusEmoji, text: myStatus.statusText }}
                onUpdate={(s) => { setMyStatus(s); setStatusPickerOpen(false); setUserMenuOpen(false); }}
                onClose={() => { setStatusPickerOpen(false); }}
              />
            )}
          </div>
        )}
      </aside>
    </>
  );
}
