import { IconGrid, IconCheck, IconFile, IconBarChart, IconUsers } from './Icons';

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

export default function Sidebar({ view, currentProjectId, projects, tasks, user, onNavigate, onNavigateProject, onNewProject, onLogout, mobileOpen, onCloseMobile }) {
  const openCount = (pid) => tasks.filter(t => t.projectId === pid && t.status !== 'done').length;

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

        <div className="sidebar-section-label">Views</div>
        <ul className="sidebar-nav">
          <li>
            <a
              href="#"
              className={view === 'tasks' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); nav('tasks'); }}
            >
              <IconCheck />
              All Tasks
            </a>
          </li>
          <li>
            <a
              href="#"
              className={view === 'notes' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); nav('notes'); }}
            >
              <IconFile />
              Notes
            </a>
          </li>
          <li>
            <a
              href="#"
              className={view === 'community' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); nav('community'); }}
            >
              <IconCommunity />
              Community
            </a>
          </li>
        </ul>

        <div className="sidebar-section-label">Custom Data</div>
        <ul className="sidebar-nav">
          <li>
            <a
              href="#"
              className={view === 'performance' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); nav('performance'); }}
            >
              <IconBarChart />
              Performance
            </a>
          </li>
        </ul>

        <div className="sidebar-section-label">Projects</div>
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
                  <span className="shared-badge" title="Shared project">
                    <IconUsers />
                  </span>
                )}
                <span className="project-badge">{openCount(project.id)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button className="sidebar-btn" onClick={() => { onNewProject(); if (onCloseMobile) onCloseMobile(); }}>+ New Project</button>

        {user && (
          <div className="user-menu">
            <span className="user-menu-name">{user.username}</span>
            <button className="user-menu-logout" onClick={onLogout}>Log out</button>
          </div>
        )}
      </aside>
    </>
  );
}
