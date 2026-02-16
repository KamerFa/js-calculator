import { useState, useEffect } from 'react';
import { DB } from '../db';
import { IconPlus, IconUsers } from './Icons';
import TaskRow from './TaskRow';

const STATUS_ORDER = ['todo', 'in-progress', 'done'];
const STATUS_LABELS = { todo: 'Todo', 'in-progress': 'In Progress', done: 'Done' };

export default function ProjectView({ project, tasks, user, onToggle, onTaskClick, onEdit, onDelete, onProjectClick, onNewTask, onEditProject, onDeleteProject, onShare }) {
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

  return (
    <div>
      <div className="project-header">
        <div className="project-header-top">
          <div className="project-header-info">
            <span className="project-header-dot" style={{ background: project.color }} />
            <div>
              <h1>
                {project.name}
                {project.isPublic && <span className="public-badge">Public</span>}
              </h1>
              <p className="desc">{project.description || 'No description'}</p>
            </div>
          </div>
          <div className="project-header-actions">
            <button className="btn btn-sm" onClick={() => onShare(project)}>
              <IconUsers /> {isShared ? `${members.length} Members` : 'Share'}
            </button>
            {isOwner && (
              <>
                <button className="btn btn-sm" onClick={() => onEditProject(project)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => onDeleteProject(project)}>Delete</button>
              </>
            )}
          </div>
        </div>

        {isShared && (
          <div className="project-members-row">
            {members.map((m) => (
              <div className="member-chip" key={m.userId} title={`${m.username} — ${m.tasks.done}/${m.tasks.total} done`}>
                <span className="member-chip-avatar">{m.username.charAt(0).toUpperCase()}</span>
                <span>{m.username}</span>
              </div>
            ))}
          </div>
        )}

        <div className="project-stats">
          <span><strong>{projectTasks.length}</strong> total</span>
          <span><strong>{openCount}</strong> open</span>
          <span><strong>{doneCount}</strong> done</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: progress + '%' }} />
        </div>
      </div>

      <div className="page-header">
        <div className="page-header-row">
          <div><h1 style={{ fontSize: 20 }}>Tasks</h1></div>
          <button className="btn btn-primary btn-sm" onClick={() => onNewTask(project.id)}>
            <IconPlus /> New Task
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

      {projectTasks.length === 0 && <div className="empty-state">No tasks in this project yet.</div>}
    </div>
  );
}
