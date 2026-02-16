import { useState, useEffect, useCallback } from 'react';
import { DB, uid } from './db';
import Sidebar from './components/Sidebar';
import TaskList from './components/TaskList';
import ProjectView from './components/ProjectView';
import NotesView from './components/NotesView';
import TaskModal from './components/TaskModal';
import ProjectModal from './components/ProjectModal';
import NoteModal from './components/NoteModal';
import ConfirmModal from './components/ConfirmModal';
import TaskDetailModal from './components/TaskDetailModal';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);

  const [view, setView] = useState('tasks');
  const [currentProjectId, setCurrentProjectId] = useState(null);

  // Modal state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalItem, setTaskModalItem] = useState(null);
  const [taskModalPrefill, setTaskModalPrefill] = useState(null);

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectModalItem, setProjectModalItem] = useState(null);

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteModalItem, setNoteModalItem] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [taskDetailItem, setTaskDetailItem] = useState(null);

  // Init
  useEffect(() => {
    (async () => {
      await DB.seed();
      setProjects(await DB.getAll('projects'));
      setTasks(await DB.getAll('tasks'));
      setNotes(await DB.getAll('notes'));
    })();
  }, []);

  const reload = useCallback(async () => {
    setProjects(await DB.getAll('projects'));
    setTasks(await DB.getAll('tasks'));
    setNotes(await DB.getAll('notes'));
  }, []);

  // Navigation
  const navigate = (v) => {
    setView(v);
    setCurrentProjectId(null);
  };

  const navigateProject = (id) => {
    setView('project');
    setCurrentProjectId(id);
  };

  const currentProject = projects.find((p) => p.id === currentProjectId) || null;

  // Task actions
  const openTaskModal = (task, prefillProjectId) => {
    setTaskModalItem(task || null);
    setTaskModalPrefill(prefillProjectId || null);
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (form) => {
    const now = new Date().toISOString();
    const existing = form.id ? tasks.find((t) => t.id === form.id) : null;
    const task = {
      id: form.id || uid(),
      title: form.title.trim(),
      description: form.description.trim(),
      projectId: form.projectId || null,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      customFields: form.customFields.filter((f) => f.key.trim()),
      createdAt: existing?.createdAt || now,
    };
    await DB.save('tasks', task);
    await reload();
    setTaskModalOpen(false);
  };

  const handleToggleTask = async (task) => {
    const updated = { ...task, status: task.status === 'done' ? 'todo' : 'done' };
    await DB.save('tasks', updated);
    await reload();
  };

  const handleDeleteTask = (task) => {
    setConfirmMessage(`Delete task "${task.title}"? This cannot be undone.`);
    setConfirmAction(() => async () => {
      await DB.delete('tasks', task.id);
      await reload();
    });
    setConfirmOpen(true);
  };

  // Project actions
  const openProjectModal = (project) => {
    setProjectModalItem(project || null);
    setProjectModalOpen(true);
  };

  const handleSaveProject = async (form) => {
    const now = new Date().toISOString();
    const existing = form.id ? projects.find((p) => p.id === form.id) : null;
    const project = {
      id: form.id || uid(),
      name: form.name.trim(),
      description: form.description.trim(),
      color: form.color,
      createdAt: existing?.createdAt || now,
    };
    await DB.save('projects', project);
    await reload();
    setProjectModalOpen(false);
  };

  const handleDeleteProject = (project) => {
    const taskCount = tasks.filter((t) => t.projectId === project.id).length;
    setConfirmMessage(`Delete project "${project.name}" and its ${taskCount} task(s)? This cannot be undone.`);
    setConfirmAction(() => async () => {
      const toDelete = tasks.filter((t) => t.projectId === project.id);
      for (const t of toDelete) await DB.delete('tasks', t.id);
      const notesToUpdate = notes.filter((n) => n.attachedTo?.type === 'project' && n.attachedTo?.id === project.id);
      for (const n of notesToUpdate) {
        await DB.save('notes', { ...n, attachedTo: null });
      }
      await DB.delete('projects', project.id);
      await reload();
      navigate('tasks');
    });
    setConfirmOpen(true);
  };

  // Note actions
  const openNoteModal = (note) => {
    setNoteModalItem(note || null);
    setNoteModalOpen(true);
  };

  const handleSaveNote = async (form) => {
    const now = new Date().toISOString();
    const existing = form.id ? notes.find((n) => n.id === form.id) : null;
    let attachedTo = null;
    if (form.attachType && form.attachId) {
      attachedTo = { type: form.attachType, id: form.attachId };
    }
    const note = {
      id: form.id || uid(),
      title: form.title.trim(),
      body: form.body.trim(),
      attachedTo,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await DB.save('notes', note);
    await reload();
    setNoteModalOpen(false);
  };

  const handleDeleteNote = async (id) => {
    await DB.delete('notes', id);
    await reload();
    setNoteModalOpen(false);
  };

  // Task detail
  const openTaskDetail = (task) => {
    setTaskDetailItem(task);
    setTaskDetailOpen(true);
  };

  return (
    <div className="app-layout">
      <Sidebar
        view={view}
        currentProjectId={currentProjectId}
        projects={projects}
        tasks={tasks}
        onNavigate={navigate}
        onNavigateProject={navigateProject}
        onNewProject={() => openProjectModal()}
      />

      <main className="main">
        {view === 'tasks' && (
          <TaskList
            tasks={tasks}
            projects={projects}
            onToggle={handleToggleTask}
            onTaskClick={openTaskDetail}
            onEdit={(t) => openTaskModal(t)}
            onDelete={handleDeleteTask}
            onProjectClick={navigateProject}
            onNewTask={() => openTaskModal()}
          />
        )}

        {view === 'project' && (
          <ProjectView
            project={currentProject}
            tasks={tasks}
            onToggle={handleToggleTask}
            onTaskClick={openTaskDetail}
            onEdit={(t) => openTaskModal(t)}
            onDelete={handleDeleteTask}
            onProjectClick={navigateProject}
            onNewTask={(pid) => openTaskModal(null, pid)}
            onEditProject={(p) => openProjectModal(p)}
            onDeleteProject={handleDeleteProject}
          />
        )}

        {view === 'notes' && (
          <NotesView
            notes={notes}
            projects={projects}
            tasks={tasks}
            onNoteClick={(n) => openNoteModal(n)}
            onNewNote={() => openNoteModal()}
          />
        )}
      </main>

      <TaskModal
        open={taskModalOpen}
        task={taskModalItem}
        projects={projects}
        prefillProjectId={taskModalPrefill}
        onSave={handleSaveTask}
        onClose={() => setTaskModalOpen(false)}
      />

      <ProjectModal
        open={projectModalOpen}
        project={projectModalItem}
        onSave={handleSaveProject}
        onClose={() => setProjectModalOpen(false)}
      />

      <NoteModal
        open={noteModalOpen}
        note={noteModalItem}
        projects={projects}
        tasks={tasks}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
        onClose={() => setNoteModalOpen(false)}
      />

      <ConfirmModal
        open={confirmOpen}
        message={confirmMessage}
        onConfirm={() => confirmAction && confirmAction()}
        onClose={() => setConfirmOpen(false)}
      />

      <TaskDetailModal
        open={taskDetailOpen}
        task={taskDetailItem}
        projects={projects}
        onClose={() => setTaskDetailOpen(false)}
        onEdit={(t) => openTaskModal(t)}
        onProjectClick={navigateProject}
      />
    </div>
  );
}
