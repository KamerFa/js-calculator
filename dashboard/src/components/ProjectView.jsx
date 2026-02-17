import { useState, useEffect } from 'react';
import { DB } from '../db';
import { IconPlus, IconUsers } from './Icons';
import TaskRow from './TaskRow';
import ProjectStatsGraph from './ProjectStatsGraph';
import ProjectCompletionSummary from './ProjectCompletionSummary';
import { useTranslation } from '../i18n';
import { getProjectStatus, getProjectTimeInfo, getProjectProgress } from '../projectStatus';

const STATUS_ORDER = ['todo', 'in-progress', 'done'];

export default function ProjectView({ project, tasks, user, onToggle, onTaskClick, onEdit, onDelete, onProjectClick, onNewTask, onEditProject, onDeleteProject, onLeaveProject, onShare, onUserClick }) {
  const { t } = useTranslation();
  const STATUS_LABELS = { todo: t('tasks.todo'), 'in-progress': t('tasks.inProgress'), done: t('tasks.done') };
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (project) {
      DB.getProjectMembers(project.id).then(setMembers).catch(() => setMembers([]));
    }
  }, [project, tasks]);

  if (!project) return null;

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const openCount = projectTasks.filter((t) => t.status !== 'done').length;
  const doneCount = projectTasks.filter((t) => t.status === 'done').length;
  const progress = projectTasks.length === 0 ? 0 : Math.round((doneCount / projectTasks.length) * 100);

  const groups = STATUS_ORDER.map((s) => ({
    status: s,
    label: STATUS_LABELS[s],
    tasks: projectTasks.filter((t) => t.status === s),
  }));

  const isShared = members.length > 1;
  const isOwner = project.isOwner;

  // Project date status
  const status = getProjectStatus(project);
  const timeInfo = getProjectTimeInfo(project);
  const timelineProgress = getProjectProgress(project);

  const statusBadge = status === 'completed'
    ? <span className="status-badge status-completed">{t('projectStatus.completed')}</span>
    : status === 'active'
    ? <span className="status-badge status-active">{t('projectStatus.active')}</span>
    : status === 'upcoming'
    ? <span className="status-badge status-upcoming">{t('projectStatus.upcoming')}</span>
    : null;

  const timeLabel = timeInfo
    ? timeInfo.type === 'remaining'
      ? t('projectStatus.daysRemaining', { days: timeInfo.days })
      : timeInfo.type === 'today'
      ? t('projectStatus.endsToday')
      : t('projectStatus.endedAgo', { days: timeInfo.days })
    : null;

  return (
    <div>
      <div className="project-header">
        <div className="project-header-top">
          <div className="project-header-info">
            <span className="project-header-dot" style={{ background: project.color }} />
            <div>
              <h1>
                {project.name}
                {project.isPublic && <span className="public-badge">{t('projects.public')}</span>}
                {statusBadge}
              </h1>
              <p className="desc">{project.description || t('projects.noDescription')}</p>
              {(project.startDate || project.endDate) && (
                <div className="project-dates-row">
                  <p className="project-dates">
                    {project.startDate && <span>{t('projects.startDate')}: {new Date(project.startDate).toLocaleDateString()}</span>}
                    {project.startDate && project.endDate && <span> — </span>}
                    {project.endDate && <span>{t('projects.endDate')}: {new Date(project.endDate).toLocaleDateString()}</span>}
                  </p>
                  {timeLabel && <span className="project-time-label">{timeLabel}</span>}
                </div>
              )}
              {/* Timeline progress bar */}
              {timelineProgress !== null && status !== 'completed' && (
                <div className="timeline-progress">
                  <div className="timeline-progress-bar">
                    <div className="timeline-progress-fill" style={{ width: `${timelineProgress}%` }} />
                  </div>
                  <span className="timeline-progress-pct">{timelineProgress}%</span>
                </div>
              )}
            </div>
          </div>
          <div className="project-header-actions">
            <button className="btn btn-sm" onClick={() => onShare(project)}>
              <IconUsers /> {isShared ? t('projects.memberCount', { count: members.length }) : t('projects.share')}
            </button>
            {isOwner ? (
              <>
                <button className="btn btn-sm" onClick={() => onEditProject(project)}>{t('modal.edit')}</button>
                <button className="btn btn-sm btn-danger" onClick={() => onDeleteProject(project)}>{t('projects.deleteProject')}</button>
              </>
            ) : (
              <button className="btn btn-sm btn-danger" onClick={() => onLeaveProject(project)}>{t('projects.leaveProject')}</button>
            )}
          </div>
        </div>

        {isShared && (
          <div className="project-members-row">
            {members.map((m) => (
              <div
                className="member-chip member-chip-clickable"
                key={m.userId}
                title={`${m.username} — ${m.tasks.done}/${m.tasks.total} ${t('tasks.completed')}`}
                onClick={() => onUserClick && onUserClick(m.username)}
              >
                <span className="member-chip-avatar">{m.username.charAt(0).toUpperCase()}</span>
                <span>{m.username}</span>
              </div>
            ))}
          </div>
        )}

        <div className="project-stats">
          <span><strong>{projectTasks.length}</strong> {t('tasks.total')}</span>
          <span><strong>{openCount}</strong> {t('tasks.open')}</span>
          <span><strong>{doneCount}</strong> {t('tasks.completed')}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: progress + '%' }} />
        </div>
      </div>

      {/* Show completion summary for completed projects */}
      {status === 'completed' && (
        <ProjectCompletionSummary project={project} tasks={tasks} />
      )}

      <ProjectStatsGraph projectId={project.id} />

      <div className="page-header">
        <div className="page-header-row">
          <div><h1 style={{ fontSize: 20 }}>{t('tasks.title')}</h1></div>
          <button className="btn btn-primary btn-sm" onClick={() => onNewTask(project.id)}>
            <IconPlus /> {t('tasks.newTask')}
          </button>
        </div>
      </div>

      {groups.map((group) =>
        group.tasks.length > 0 ? (
          <div className="task-group" key={group.status}>
            <div className="task-group-header">
              <span>{group.label}</span>
              <span className="task-group-count">{group.tasks.length}</span>
            </div>
            {group.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                project={null}
                showProject={false}
                showCreator={isShared}
                currentUserId={user?.id}
                onToggle={onToggle}
                onClick={onTaskClick}
                onEdit={onEdit}
                onDelete={onDelete}
                onProjectClick={onProjectClick}
              />
            ))}
          </div>
        ) : null
      )}

      {projectTasks.length === 0 && <div className="empty-state">{t('tasks.noTasks')}</div>}
    </div>
  );
}
