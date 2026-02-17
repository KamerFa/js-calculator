import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DB } from '../db';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [notes, setNotes] = useState([]);

  const reload = useCallback(async () => {
    const [p, t, n] = await Promise.all([
      DB.getAll('projects'),
      DB.getAll('tasks'),
      DB.getAll('notes'),
    ]);
    setProjects(p);
    setTasks(t);
    setNotes(n);
  }, []);

  useEffect(() => {
    if (user) reload();
  }, [user, reload]);

  // ── Task actions ─────────────────────────────────────────
  const saveTask = useCallback(async (form) => {
    const task = {
      id: form.id || undefined,
      title: form.title.trim(),
      description: form.description.trim(),
      projectId: form.projectId || null,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      scheduledDate: form.scheduledDate || null,
      recurrence: form.recurrence || 'none',
      taskType: form.taskType || 'shared',
      customFields: form.customFields.filter((f) => f.key.trim()),
    };
    const saved = await DB.save('tasks', task);
    if (form._screenshotFile && saved?.id) {
      await DB.uploadScreenshot(saved.id, form._screenshotFile);
    }
    await reload();
    return saved;
  }, [reload]);

  const toggleTask = useCallback(async (task, completionDate) => {
    const updated = { ...task, status: task.status === 'done' ? 'todo' : 'done' };
    if (completionDate) updated.completionDate = completionDate;
    await DB.save('tasks', updated);
    await reload();
  }, [reload]);

  const deleteTask = useCallback(async (taskId) => {
    await DB.delete('tasks', taskId);
    await reload();
  }, [reload]);

  // ── Project actions ──────────────────────────────────────
  const saveProject = useCallback(async (form) => {
    const project = {
      id: form.id || undefined,
      name: form.name.trim(),
      description: form.description.trim(),
      color: form.color,
      isPublic: form.isPublic || false,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };
    await DB.save('projects', project);
    await reload();
  }, [reload]);

  const deleteProject = useCallback(async (projectId) => {
    await DB.deleteTasksByProject(projectId);
    await DB.clearNoteAttachment('project', projectId);
    await DB.delete('projects', projectId);
    await reload();
  }, [reload]);

  const leaveProject = useCallback(async (projectId, userId) => {
    await DB.removeProjectMember(projectId, userId);
    await reload();
  }, [reload]);

  const importProject = useCallback(async (data) => {
    await DB.importProject(data);
    await reload();
  }, [reload]);

  // ── Note actions ─────────────────────────────────────────
  const saveNote = useCallback(async (form) => {
    let attachedTo = null;
    if (form.attachType && form.attachId) {
      attachedTo = { type: form.attachType, id: form.attachId };
    }
    await DB.save('notes', {
      id: form.id || undefined,
      title: form.title.trim(),
      body: form.body.trim(),
      attachedTo,
    });
    await reload();
  }, [reload]);

  const deleteNote = useCallback(async (id) => {
    await DB.delete('notes', id);
    await reload();
  }, [reload]);

  return (
    <DataContext.Provider value={{
      tasks, projects, notes, reload,
      saveTask, toggleTask, deleteTask,
      saveProject, deleteProject, leaveProject, importProject,
      saveNote, deleteNote,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
