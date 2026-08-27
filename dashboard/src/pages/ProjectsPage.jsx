import { useNavigate } from 'react-router';
import { useData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';
import { useAuth } from '../context/AuthContext';
import { IconPlus } from '../components/Icons';
import { getProjectStatus, getProjectTimeInfo } from '../projectStatus';
import { useTranslation } from '../i18n';

export default function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projects, tasks } = useData();
  const { user } = useAuth();
  const { openProjectModal, openImportModal } = useModals();

  const getStats = (pid) => {
    const pt = tasks.filter(t => t.projectId === pid);
    const done = pt.filter(t => t.status === 'done').length;
    return { total: pt.length, done, open: pt.length - done };
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <h1>{t('sidebar.projects') || 'Projects'}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => openProjectModal()}>
              <IconPlus /> {t('projects.newProject') || 'New Project'}
            </button>
            <button className="btn btn-sm" onClick={() => openImportModal()}>Import</button>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">{t('projects.noProjects') || 'No projects yet. Create one to get started.'}</div>
      ) : (
        <div className="projects-grid">
          {projects.map(project => {
            const stats = getStats(project.id);
            const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
            const status = getProjectStatus(project);
            const timeInfo = getProjectTimeInfo(project);

            return (
              <div
                className="project-card"
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
              >
                <div className="project-card-header">
                  <span className="project-card-dot" style={{ background: project.color }} />
                  <span className="project-card-name">{project.name}</span>
                  {status === 'completed' && <span className="project-card-status done">Done</span>}
                  {status === 'active' && <span className="project-card-status active">Active</span>}
                  {status === 'upcoming' && <span className="project-card-status upcoming">Upcoming</span>}
                </div>

                {project.description && (
                  <p className="project-card-desc">{project.description}</p>
                )}

                <div className="project-card-progress">
                  <div className="project-card-bar">
                    <div className="project-card-bar-fill" style={{ width: `${pct}%`, background: project.color }} />
                  </div>
                  <span className="project-card-pct">{pct}%</span>
                </div>

                <div className="project-card-footer">
                  <span className="project-card-stat">{stats.done}/{stats.total} tasks</span>
                  {stats.open > 0 && <span className="project-card-stat">{stats.open} open</span>}
                  {project.memberCount > 1 && (
                    <span className="project-card-members">{project.memberCount} members</span>
                  )}
                  {timeInfo && (
                    <span className="project-card-time">
                      {timeInfo.type === 'remaining' ? `${timeInfo.days}d left` : timeInfo.type === 'today' ? 'Ends today' : `${timeInfo.days}d ago`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
