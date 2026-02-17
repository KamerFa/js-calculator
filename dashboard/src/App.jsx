import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router';
import { useAuth } from './context/AuthContext';
import { useData } from './context/DataContext';
import { useModals } from './context/ModalContext';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import ModalHost from './components/ModalHost';
import radioAudio from './radioAudio';

// ── Pages ────────────────────────────────────────────────
import TasksPage from './pages/TasksPage';
import ProjectPage from './pages/ProjectPage';
import CalendarPage from './pages/CalendarPage';
import NotesPage from './pages/NotesPage';
import CommunityPage from './pages/CommunityPage';
import ProfilePage from './pages/ProfilePage';
import UsersPage from './pages/UsersPage';
import RadioPage from './pages/RadioPage';

// ── Radio mini player ────────────────────────────────────
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

function RadioMiniPlayer() {
  const { playing, volume } = useRadioState();
  const navigate = useNavigate();
  if (!playing) return null;

  return (
    <div className="radio-mini-player" onClick={() => navigate('/radio')}>
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

// ── App shell ────────────────────────────────────────────
export default function App() {
  const { user, authChecked, handleAuth, logout } = useAuth();
  const { projects, tasks } = useData();
  const { openProjectModal, openImportModal } = useModals();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!authChecked) return null;

  if (!user) {
    return <LoginPage onAuth={handleAuth} />;
  }

  const isRadioPage = location.pathname === '/radio';

  return (
    <div className="app-layout">
      {!mobileOpen && (
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      <Sidebar
        projects={projects}
        tasks={tasks}
        user={user}
        onNewProject={() => openProjectModal()}
        onImportProject={() => openImportModal()}
        onLogout={logout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main className="main" onClick={() => mobileOpen && setMobileOpen(false)}>
        <Routes>
          <Route index element={<TasksPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="community" element={<CommunityPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="radio" element={<RadioPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/:username" element={<ProfilePage />} />
          <Route path="project/:id" element={<ProjectPage />} />
        </Routes>

        {!isRadioPage && <RadioMiniPlayer />}
      </main>

      <ModalHost />
    </div>
  );
}
