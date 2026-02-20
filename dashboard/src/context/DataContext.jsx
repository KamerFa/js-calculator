import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DB } from '../db';
import { useAuth } from './AuthContext';
import { useToast } from '../components/Toast';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const { addToast } = useToast();
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

  // Helper: upsert an item in an array by id
  const upsert = (prev, item) => {
    const idx = prev.findIndex(x => x.id === item.id);
    return idx === -1 ? [...prev, item] : [...prev.slice(0, idx), item, ...prev.slice(idx + 1)];
  };

  // ── Task actions ─────────────────────────────────────────
  const saveTask = useCallback(async (form) => {
    try {
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
      const freshTasks = await DB.getAll('tasks');
      setTasks(freshTasks);
      addToast(form.id ? 'Task updated' : 'Task created', 'success');
      return saved;
    } catch (err) {
      addToast('Failed to save task', 'error');
      throw err;
    }
  }, [addToast]);

  const toggleTask = useCallback(async (task, completionDate) => {
    const updated = { ...task, status: task.status === 'done' ? 'todo' : 'done' };
    if (completionDate) updated.completionDate = completionDate;
    await DB.save('tasks', updated);
    const freshTasks = await DB.getAll('tasks');
    setTasks(freshTasks);
  }, []);

  const deleteTask = useCallback(async (taskId) => {
    try {
      await DB.delete('tasks', taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      addToast('Task deleted', 'success');
    } catch (err) {
      addToast('Failed to delete task', 'error');
      throw err;
    }
  }, [addToast]);

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
    const saved = await DB.save('projects', project);
    if (saved) {
      setProjects(prev => upsert(prev, saved));
    } else {
      const freshProjects = await DB.getAll('projects');
      setProjects(freshProjects);
    }
  }, []);

  const deleteProject = useCallback(async (projectId) => {
    try {
      await DB.deleteTasksByProject(projectId);
      await DB.clearNoteAttachment('project', projectId);
      await DB.delete('projects', projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      setTasks(prev => prev.filter(t => t.projectId !== projectId));
      setNotes(prev => prev.map(n => {
        if (n.attachedTo?.type === 'project' && n.attachedTo?.id === projectId) {
          return { ...n, attachedTo: null };
        }
        return n;
      }));
      addToast('Project deleted', 'success');
    } catch (err) {
      addToast('Failed to delete project', 'error');
      throw err;
    }
  }, [addToast]);

  const leaveProject = useCallback(async (projectId, userId) => {
    await DB.removeProjectMember(projectId, userId);
    setProjects(prev => prev.filter(p => p.id !== projectId));
  }, []);

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
    const saved = await DB.save('notes', {
      id: form.id || undefined,
      title: form.title.trim(),
      body: form.body.trim(),
      attachedTo,
    });
    if (saved) {
      setNotes(prev => upsert(prev, saved));
    } else {
      const freshNotes = await DB.getAll('notes');
      setNotes(freshNotes);
    }
  }, []);

  const deleteNote = useCallback(async (id) => {
    await DB.delete('notes', id);
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

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
