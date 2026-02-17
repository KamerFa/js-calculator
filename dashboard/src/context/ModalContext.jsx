import { createContext, useContext, useState, useCallback } from 'react';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [taskModal, setTaskModal] = useState({ open: false, task: null, prefillProjectId: null });
  const [projectModal, setProjectModal] = useState({ open: false, project: null });
  const [noteModal, setNoteModal] = useState({ open: false, note: null });
  const [confirm, setConfirm] = useState({ open: false, message: '', action: null });
  const [taskDetail, setTaskDetail] = useState({ open: false, task: null });
  const [shareModal, setShareModal] = useState({ open: false, project: null });
  const [importModal, setImportModal] = useState(false);

  const openTaskModal = useCallback((task, prefillProjectId) => {
    setTaskModal({ open: true, task: task || null, prefillProjectId: prefillProjectId || null });
  }, []);
  const closeTaskModal = useCallback(() => setTaskModal({ open: false, task: null, prefillProjectId: null }), []);

  const openProjectModal = useCallback((project) => {
    setProjectModal({ open: true, project: project || null });
  }, []);
  const closeProjectModal = useCallback(() => setProjectModal({ open: false, project: null }), []);

  const openNoteModal = useCallback((note) => {
    setNoteModal({ open: true, note: note || null });
  }, []);
  const closeNoteModal = useCallback(() => setNoteModal({ open: false, note: null }), []);

  const openConfirm = useCallback((message, action) => {
    setConfirm({ open: true, message, action });
  }, []);
  const closeConfirm = useCallback(() => setConfirm({ open: false, message: '', action: null }), []);

  const openTaskDetail = useCallback((task) => {
    setTaskDetail({ open: true, task });
  }, []);
  const closeTaskDetail = useCallback(() => setTaskDetail({ open: false, task: null }), []);

  const openShareModal = useCallback((project) => {
    setShareModal({ open: true, project });
  }, []);
  const closeShareModal = useCallback(() => setShareModal({ open: false, project: null }), []);

  const openImportModal = useCallback(() => setImportModal(true), []);
  const closeImportModal = useCallback(() => setImportModal(false), []);

  return (
    <ModalContext.Provider value={{
      taskModal, openTaskModal, closeTaskModal,
      projectModal, openProjectModal, closeProjectModal,
      noteModal, openNoteModal, closeNoteModal,
      confirm, openConfirm, closeConfirm,
      taskDetail, openTaskDetail, closeTaskDetail,
      shareModal, openShareModal, closeShareModal,
      importModal, openImportModal, closeImportModal,
    }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModals() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModals must be used within ModalProvider');
  return ctx;
}
