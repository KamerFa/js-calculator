import { useData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';
import NotesView from '../components/NotesView';

export default function NotesPage() {
  const { notes, projects, tasks } = useData();
  const { openNoteModal } = useModals();

  return (
    <NotesView
      notes={notes}
      projects={projects}
      tasks={tasks}
      onNoteClick={(n) => openNoteModal(n)}
      onNewNote={() => openNoteModal()}
    />
  );
}
