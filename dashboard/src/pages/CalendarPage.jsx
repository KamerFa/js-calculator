import { useNavigate } from 'react-router';
import { useData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';
import CalendarView from '../components/CalendarView';

export default function CalendarPage() {
  const { tasks, projects, toggleTask, deleteTask } = useData();
  const { openTaskModal, openTaskDetail, openConfirm } = useModals();
  const navigate = useNavigate();

  const handleDelete = (task) => {
    openConfirm(`Delete task "${task.title}"? This cannot be undone.`, async () => {
      await deleteTask(task.id);
    });
  };

  return (
    <CalendarView
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
