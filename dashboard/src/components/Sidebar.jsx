import { useState, useEffect } from 'react';
import { IconGrid, IconCheck, IconFile, IconBarChart, IconUsers } from './Icons';
import { useTranslation } from '../i18n';

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

export default function Sidebar({ view, currentProjectId, projects, tasks, user, onNavigate, onNavigateProject, onNewProject, onLogout, mobileOpen, onCloseMobile }) {
  const { t } = useTranslation();
  const openCount = (pid) => tasks.filter(t => t.projectId === pid && t.status !== 'done').length;

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
          {t('app.title')}
        </div>

        <div className="sidebar-section-label">{t('sidebar.tasks')}</div>
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
        </ul>

        {user?.username?.toLowerCase() === 'kamer' && (
          <>
            <div className="sidebar-section-label">Custom Data</div>
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
          </>
        )}

        <div className="sidebar-section-label">{t('sidebar.projects')}</div>
        <ul className="sidebar-nav">
          {projects.map((project) => (
            <li key={project.id}>
              <button
                className={view === 'project' && currentProjectId === project.id ? 'active' : ''}
                onClick={() => navProject(project.id)}
              >
                <span className="project-dot" style={{ background: project.color }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {project.name}
                </span>
                {project.memberCount > 1 && (
                  <span className="shared-badge" title={t('projects.share')}>
                    <IconUsers />
                  </span>
                )}
                <span className="project-badge">{openCount(project.id)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button className="sidebar-btn" onClick={() => { onNewProject(); if (onCloseMobile) onCloseMobile(); }}>+ {t('projects.newProject')}</button>

        {!isInstalled && installPrompt && (
          <button className="sidebar-install-btn" onClick={handleInstall}>
            <IconDownload /> Install App
          </button>
        )}

        {user && (
          <div className="user-menu">
            <span
              className="user-menu-name"
              style={{ cursor: 'pointer' }}
              onClick={() => nav('profile')}
            >{user.username}</span>
            <button className="user-menu-logout" onClick={onLogout}>{t('auth.logout')}</button>
          </div>
        )}
      </aside>
    </>
  );
}
