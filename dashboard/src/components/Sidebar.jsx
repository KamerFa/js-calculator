import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { IconGrid, IconCheck, IconFile, IconUsers, IconRadio } from './Icons';
import { useTranslation } from '../i18n';
import { resolveAvatarUrl } from '../avatarUtils';
import { getProjectStatus } from '../projectStatus';

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

export default function Sidebar({ projects, tasks, user, onNewProject, onImportProject, onLogout, mobileOpen, onCloseMobile }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const openCount = (pid) => tasks.filter(t => t.projectId === pid && t.status !== 'done').length;

  // Derive current view and project id from URL
  const pathname = location.pathname;
  const view = pathname === '/' ? 'tasks'
    : pathname.startsWith('/project/') ? 'project'
    : pathname.slice(1).split('/')[0] || 'tasks';
  const currentProjectId = pathname.startsWith('/project/') ? pathname.split('/')[2] : null;

  // Accordion state
  const [accordionOpen, setAccordionOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_accordions');
      return saved ? JSON.parse(saved) : { tasks: true, projects: true };
    } catch {
      return { tasks: true, projects: true };
    }
  });

  const toggleAccordion = (key) => {
    setAccordionOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('sidebar_accordions', JSON.stringify(next));
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

        {/* Tasks section - accordion */}
        <button className="sidebar-accordion-toggle" onClick={() => toggleAccordion('tasks')}>
          <IconChevron open={accordionOpen.tasks} />
          <span>{t('sidebar.tasks')}</span>
        </button>
        {accordionOpen.tasks && (
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
                href="/radio"
                className={view === 'radio' ? 'active' : ''}
                onClick={(e) => { e.preventDefault(); nav('/radio'); }}
              >
                <IconRadio />
                Radio
              </a>
            </li>
          </ul>
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

        {!isInstalled && installPrompt && (
          <button className="sidebar-install-btn" onClick={handleInstall}>
            <IconDownload /> Install App
          </button>
        )}

        {user && (
          <div className="user-menu">
            <div className="user-menu-info" style={{ cursor: 'pointer' }} onClick={() => nav('/profile')}>
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
