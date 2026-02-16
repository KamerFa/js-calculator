import { IconGrid, IconCheck, IconFile, IconBarChart } from './Icons';

export default function Sidebar({ view, currentProjectId, projects, tasks, user, onNavigate, onNavigateProject, onNewProject, onLogout }) {
  const openCount = (pid) => tasks.filter(t => t.projectId === pid && t.status !== 'done').length;

  return (
    <aside className="sidebar">
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
            onClick={(e) => { e.preventDefault(); onNavigate('tasks'); }}
          >
            <IconCheck />
            All Tasks
          </a>
        </li>
        <li>
          <a
            href="#"
            className={view === 'performance' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); onNavigate('performance'); }}
          >
            <IconBarChart />
            Performance
          </a>
        </li>
        <li>
          <a
            href="#"
            className={view === 'notes' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); onNavigate('notes'); }}
          >
            <IconFile />
            Notes
          </a>
        </li>
      </ul>

      <div className="sidebar-section-label">Projects</div>
      <ul className="sidebar-nav">
        {projects.map((project) => (
          <li key={project.id}>
            <button
              className={view === 'project' && currentProjectId === project.id ? 'active' : ''}
              onClick={() => onNavigateProject(project.id)}
            >
              <span className="project-dot" style={{ background: project.color }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.name}
              </span>
              <span className="project-badge">{openCount(project.id)}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="sidebar-btn" onClick={onNewProject}>+ New Project</button>

      {user && (
        <div className="user-menu">
          <span className="user-menu-name">{user.username}</span>
          <button className="user-menu-logout" onClick={onLogout}>Log out</button>
        </div>
      )}
    </aside>
  );
}
