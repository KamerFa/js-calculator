import { useState, useEffect, useCallback } from 'react';
import { DB, isLoggedIn, authMe, authLogout } from './db';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import TaskList from './components/TaskList';
import ProjectView from './components/ProjectView';
import NotesView from './components/NotesView';
import CommunityView from './components/CommunityView';
import CalendarView from './components/CalendarView';
import TaskModal from './components/TaskModal';
import ProjectModal from './components/ProjectModal';
import NoteModal from './components/NoteModal';
import ConfirmModal from './components/ConfirmModal';
import TaskDetailModal from './components/TaskDetailModal';
import PerformanceView from './components/PerformanceView';
import ProfileView from './components/ProfileView';
import UsersView from './components/UsersView';
import FaceitSettingsModal from './components/FaceitSettingsModal';
import ShareModal from './components/ShareModal';
import ImportProjectModal from './components/ImportProjectModal';
import RadioView from './components/RadioView';
import radioAudio from './radioAudio';

function useRadioState() {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    return radioAudio.subscribe(() => forceUpdate((n) => n + 1));
  }, []);
  return {
    playing: radioAudio.getStation(),
    volume: radioAudio.getVolume(),
  };
}

function RadioMiniPlayer({ onGoToRadio }) {
  const { playing, volume } = useRadioState();
  if (!playing) return null;

  return (
    <div className="radio-mini-player" onClick={onGoToRadio}>
      <div className="radio-now-eq">
        <span /><span /><span /><span />
      </div>
      <div className="radio-mini-info">
        <span className="radio-mini-name">{playing.name}</span>
        <span className="radio-mini-genre">{playing.genre}</span>
      </div>
      <input
        type="range"
        className="radio-volume"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => { e.stopPropagation(); radioAudio.setVolume(e.target.value); }}
        title={`${Math.round(volume * 100)}%`}
      />
      <button className="radio-stop-btn" onClick={(e) => { e.stopPropagation(); radioAudio.stop(); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
      </button>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);

  const [view, setView] = useState('tasks');
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [profileUsername, setProfileUsername] = useState(null);

  // Mobile sidebar
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const [faceitSettingsOpen, setFaceitSettingsOpen] = useState(false);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalProject, setShareModalProject] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // ── Auth check ──────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn()) {
      setAuthChecked(true);
      return;
    }
    authMe()
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('dash_token');
      })
      .finally(() => setAuthChecked(true));
  }, []);

  // ── Load data after login ─────────────────────────────────
  const reload = useCallback(async () => {
    setProjects(await DB.getAll('projects'));
    setTasks(await DB.getAll('tasks'));
    setNotes(await DB.getAll('notes'));
  }, []);

  useEffect(() => {
    if (user) reload();
  }, [user, reload]);

  // ── Auth handlers ─────────────────────────────────────────
  const handleAuth = (userData) => {
    setUser(userData);
  };

  // ── Navigation ────────────────────────────────────────────
  const navigate = (v) => {
    setView(v);
    setCurrentProjectId(null);
    setProfileUsername(null);
  };

  const navigateProject = (id) => {
    setView('project');
    setCurrentProjectId(id);
  };

  const navigateProfile = (username) => {
    setProfileUsername(username || null);
    setView('profile');
  };

  const currentProject = projects.find((p) => p.id === currentProjectId) || null;

  // ── Task actions ──────────────────────────────────────────
  const openTaskModal = (task, prefillProjectId) => {
    setTaskModalItem(task || null);
    setTaskModalPrefill(prefillProjectId || null);
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (form) => {
    const task = {
      id: form.id || undefined,
      title: form.title.trim(),
      description: form.description.trim(),
      projectId: form.projectId || null,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      recurrence: form.recurrence || 'none',
      taskType: form.taskType || 'shared',
      customFields: form.customFields.filter((f) => f.key.trim()),
    };
    const saved = await DB.save('tasks', task);
    if (form._screenshotFile && saved?.id) {
      await DB.uploadScreenshot(saved.id, form._screenshotFile);
    }
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

  // ── Project actions ───────────────────────────────────────
  const openProjectModal = (project) => {
    setProjectModalItem(project || null);
    setProjectModalOpen(true);
  };

  const handleSaveProject = async (form) => {
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
    setProjectModalOpen(false);
  };

  const handleImportProject = async (data) => {
    await DB.importProject(data);
    await reload();
    setImportModalOpen(false);
  };

  const handleDeleteProject = (project) => {
    const taskCount = tasks.filter((t) => t.projectId === project.id).length;
    setConfirmMessage(`Delete project "${project.name}" and its ${taskCount} task(s)? This cannot be undone.`);
    setConfirmAction(() => async () => {
      await DB.deleteTasksByProject(project.id);
      await DB.clearNoteAttachment('project', project.id);
      await DB.delete('projects', project.id);
      await reload();
      navigate('tasks');
    });
    setConfirmOpen(true);
  };

  const handleLeaveProject = (project) => {
    setConfirmMessage(`Leave project "${project.name}"? You can be re-invited later.`);
    setConfirmAction(() => async () => {
      await DB.removeProjectMember(project.id, user.id);
      await reload();
      navigate('tasks');
    });
    setConfirmOpen(true);
  };

  // ── Share actions ──────────────────────────────────────────
  const openShareModal = (project) => {
    setShareModalProject(project);
    setShareModalOpen(true);
  };

  // ── Note actions ──────────────────────────────────────────
  const openNoteModal = (note) => {
    setNoteModalItem(note || null);
    setNoteModalOpen(true);
  };

  const handleSaveNote = async (form) => {
    let attachedTo = null;
    if (form.attachType && form.attachId) {
      attachedTo = { type: form.attachType, id: form.attachId };
    }
    const note = {
      id: form.id || undefined,
      title: form.title.trim(),
      body: form.body.trim(),
      attachedTo,
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

  // ── Task detail ───────────────────────────────────────────
  const openTaskDetail = (task) => {
    setTaskDetailItem(task);
    setTaskDetailOpen(true);
  };

  // ── Render ────────────────────────────────────────────────
  if (!authChecked) return null; // Loading

  if (!user) {
    return <LoginPage onAuth={handleAuth} />;
  }

  return (
    <div className="app-layout">
      {/* Mobile hamburger button */}
      <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <Sidebar
        view={view}
        currentProjectId={currentProjectId}
        projects={projects}
        tasks={tasks}
        user={user}
        onNavigate={navigate}
        onNavigateProject={navigateProject}
        onNewProject={() => openProjectModal()}
        onImportProject={() => setImportModalOpen(true)}
        onLogout={authLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
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
            user={user}
            onToggle={handleToggleTask}
            onTaskClick={openTaskDetail}
            onEdit={(t) => openTaskModal(t)}
            onDelete={handleDeleteTask}
            onProjectClick={navigateProject}
            onNewTask={(pid) => openTaskModal(null, pid)}
            onEditProject={(p) => openProjectModal(p)}
            onDeleteProject={handleDeleteProject}
            onLeaveProject={handleLeaveProject}
            onShare={openShareModal}
            onUserClick={navigateProfile}
          />
        )}

        {view === 'performance' && (
          <PerformanceView onOpenSettings={() => setFaceitSettingsOpen(true)} />
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

        {view === 'community' && (
          <CommunityView
            user={user}
            onProjectClick={navigateProject}
            onReload={reload}
            onUserClick={navigateProfile}
          />
        )}

        {view === 'profile' && (
          <ProfileView user={user} profileUsername={profileUsername} onProjectClick={navigateProject} onReload={reload} />
        )}

        {view === 'users' && (
          <UsersView onUserClick={(username) => navigateProfile(username)} />
        )}

        {view === 'radio' && <RadioView />}

        {view !== 'radio' && <RadioMiniPlayer onGoToRadio={() => navigate('radio')} />}

        {view === 'calendar' && (
          <CalendarView
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

      <FaceitSettingsModal
        open={faceitSettingsOpen}
        onClose={() => setFaceitSettingsOpen(false)}
        onSaved={() => {}}
      />

      <ShareModal
        open={shareModalOpen}
        project={shareModalProject}
        user={user}
        onClose={() => setShareModalOpen(false)}
        onChanged={reload}
      />

      <ImportProjectModal
        open={importModalOpen}
        onImport={handleImportProject}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  );
}
