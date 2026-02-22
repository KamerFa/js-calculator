import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';
import { DB } from '../db';
import ProjectView from '../components/ProjectView';

export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tasks, projects, notes, toggleTask, deleteTask, deleteProject, leaveProject, reload } = useData();
  const { openTaskModal, openTaskDetail, openProjectModal, openNoteModal, openShareModal, openConfirm } = useModals();

  const project = projects.find((p) => p.id === id) || null;

  const handleDeleteTask = (task) => {
    openConfirm(`Delete task "${task.title}"? This cannot be undone.`, async () => {
      await deleteTask(task.id);
    });
  };

  const handleDeleteProject = (proj) => {
    const taskCount = tasks.filter((t) => t.projectId === proj.id).length;
    openConfirm(`Delete project "${proj.name}" and its ${taskCount} task(s)? This cannot be undone.`, async () => {
      await deleteProject(proj.id);
      navigate('/');
    });
  };

  const handleLeaveProject = (proj) => {
    openConfirm(`Leave project "${proj.name}"? You can be re-invited later.`, async () => {
      await leaveProject(proj.id, user.id);
      navigate('/');
    });
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      await DB.save('tasks', { ...task, status: newStatus });
      await reload();
    } catch { /* ignore */ }
  };

  return (
    <ProjectView
      project={project}
      tasks={tasks}
      notes={notes}
      user={user}
      onToggle={toggleTask}
      onTaskClick={openTaskDetail}
      onEdit={(t) => openTaskModal(t)}
      onDelete={handleDeleteTask}
      onProjectClick={(pid) => navigate(`/project/${pid}`)}
      onNewTask={(pid) => openTaskModal(null, pid)}
      onEditProject={(p) => openProjectModal(p)}
      onDeleteProject={handleDeleteProject}
      onLeaveProject={handleLeaveProject}
      onShare={openShareModal}
      onUserClick={(username) => navigate(`/profile/${username}`)}
      onNoteClick={(n) => openNoteModal(n)}
      onNewNote={() => openNoteModal()}
      onStatusChange={handleStatusChange}
    />
  );
}
