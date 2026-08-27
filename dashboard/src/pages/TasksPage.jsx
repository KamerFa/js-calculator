import { useData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';
import { useNavigate } from 'react-router';
import TaskList from '../components/TaskList';

export default function TasksPage() {
  const { tasks, projects, toggleTask, deleteTask } = useData();
  const { openTaskModal, openTaskDetail, openConfirm } = useModals();
  const navigate = useNavigate();

  const handleDelete = (task) => {
    openConfirm(`Delete task "${task.title}"? This cannot be undone.`, async () => {
      await deleteTask(task.id);
    });
  };

  return (
    <TaskList
      tasks={tasks}
      projects={projects}
      onToggle={toggleTask}
      onTaskClick={openTaskDetail}
      onEdit={(t) => openTaskModal(t)}
      onDelete={handleDelete}
      onProjectClick={(id) => navigate(`/project/${id}`)}
      onNewTask={() => openTaskModal()}
    />
  );
}
