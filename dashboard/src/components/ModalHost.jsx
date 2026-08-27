import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';
import TaskModal from './TaskModal';
import ProjectModal from './ProjectModal';
import NoteModal from './NoteModal';
import ConfirmModal from './ConfirmModal';
import TaskDetailModal from './TaskDetailModal';
import ShareModal from './ShareModal';
import ImportProjectModal from './ImportProjectModal';

export default function ModalHost() {
  const { user } = useAuth();
  const { projects, tasks, notes, reload, saveTask, saveProject, saveNote, deleteNote, deleteTask, importProject } = useData();
  const {
    taskModal, closeTaskModal,
    projectModal, closeProjectModal,
    noteModal, closeNoteModal,
    confirm, closeConfirm, openConfirm,
    taskDetail, closeTaskDetail, openTaskModal, openNoteModal,
    shareModal, closeShareModal,
    importModal, closeImportModal,
  } = useModals();
  const navigate = useNavigate();

  // ── Global Escape key handler for all modals ──
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      // Close topmost modal (priority order: confirm > task detail > share > import > note > project > task)
      if (confirm.open) { closeConfirm(); return; }
      if (taskDetail.open) { closeTaskDetail(); return; }
      if (shareModal.open) { closeShareModal(); return; }
      if (importModal) { closeImportModal(); return; }
      if (noteModal.open) { closeNoteModal(); return; }
      if (projectModal.open) { closeProjectModal(); return; }
      if (taskModal.open) { closeTaskModal(); return; }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [confirm.open, taskDetail.open, shareModal.open, importModal, noteModal.open, projectModal.open, taskModal.open,
      closeConfirm, closeTaskDetail, closeShareModal, closeImportModal, closeNoteModal, closeProjectModal, closeTaskModal]);

  const handleSaveTask = async (form) => {
    await saveTask(form);
    closeTaskModal();
  };

  const handleSaveProject = async (form) => {
    await saveProject(form);
    closeProjectModal();
  };

  const handleSaveNote = async (form) => {
    await saveNote(form);
    closeNoteModal();
  };

  const handleDeleteNote = async (id) => {
    await deleteNote(id);
    closeNoteModal();
  };

  const handleImport = async (data) => {
    await importProject(data);
    closeImportModal();
  };

  return (
    <>
      <TaskModal
        open={taskModal.open}
        task={taskModal.task}
        projects={projects}
        prefillProjectId={taskModal.prefillProjectId}
        onSave={handleSaveTask}
        onClose={closeTaskModal}
      />

      <ProjectModal
        open={projectModal.open}
        project={projectModal.project}
        onSave={handleSaveProject}
        onClose={closeProjectModal}
      />

      <NoteModal
        open={noteModal.open}
        note={noteModal.note}
        projects={projects}
        tasks={tasks}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
        onClose={closeNoteModal}
      />

      <ConfirmModal
        open={confirm.open}
        message={confirm.message}
        onConfirm={() => confirm.action && confirm.action()}
        onClose={closeConfirm}
      />

      <TaskDetailModal
        open={taskDetail.open}
        task={taskDetail.task}
        projects={projects}
        notes={notes}
        onClose={closeTaskDetail}
        onEdit={(t) => openTaskModal(t)}
        onDelete={(t) => {
          closeTaskDetail();
          openConfirm(`Delete "${t.title}"?`, async () => {
            await deleteTask(t.id);
          });
        }}
        onNoteClick={(n) => { closeTaskDetail(); openNoteModal(n); }}
        onProjectClick={(id) => navigate(`/project/${id}`)}
      />

      <ShareModal
        open={shareModal.open}
        project={shareModal.project}
        user={user}
        onClose={closeShareModal}
        onChanged={reload}
      />

      <ImportProjectModal
        open={importModal}
        onImport={handleImport}
        onClose={closeImportModal}
      />
    </>
  );
}
