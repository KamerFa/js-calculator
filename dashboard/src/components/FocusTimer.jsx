import { useState, useEffect, useRef, useCallback } from 'react';
import { DB } from '../db';
import { useData } from '../context/DataContext';

const PRESETS = [
  { label: '25m', seconds: 1500 },
  { label: '15m', seconds: 900 },
  { label: '50m', seconds: 3000 },
  { label: '5m', seconds: 300 },
];

const BREAK_DURATION = 300; // 5 min break

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function FocusTimer() {
  const { tasks } = useData();

  // Timer state
  const [phase, setPhase] = useState('idle'); // idle | focus | break | done
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalDuration, setTotalDuration] = useState(1500);
  const [sessionId, setSessionId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [paused, setPaused] = useState(false);

  // Daily stats
  const [todayStats, setTodayStats] = useState({ sessions: 0, totalSeconds: 0 });

  // UI state
  const [expanded, setExpanded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const intervalRef = useRef(null);
  const panelRef = useRef(null);

  // Load today's stats
  const loadStats = useCallback(async () => {
    try {
      const data = await DB.getFocusToday();
      setTodayStats(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Timer tick
  useEffect(() => {
    if ((phase === 'focus' || phase === 'break') && !paused) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            if (phase === 'focus') {
              handleFocusComplete();
            } else {
              setPhase('idle');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [phase, paused]);

  // Keyboard shortcut: F key to toggle focus timer (when not in input)
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'f' || e.key === 'F') {
        if (e.shiftKey) {
          e.preventDefault();
          if (phase === 'focus' || phase === 'break') {
            togglePause();
          } else {
            setExpanded((prev) => !prev);
          }
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [phase, paused]);

  // Close picker on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        if (phase === 'idle') setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded, phase]);

  const handleFocusComplete = async () => {
    // Complete the session on the server
    if (sessionId) {
      try {
        await DB.completeFocusSession(sessionId);
      } catch { /* ignore */ }
    }
    setPhase('done');
    setSessionId(null);
    loadStats();

    // Play a subtle sound (use Web Audio API)
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 830;
      osc.type = 'sine';
      gain.gain.value = 0.15;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.stop(ctx.currentTime + 0.8);
    } catch { /* ignore */ }
  };

  const startFocus = async (duration) => {
    const dur = duration || 1500;
    setTotalDuration(dur);
    setTimeLeft(dur);
    setPaused(false);
    setPhase('focus');
    setShowPicker(false);

    try {
      const data = await DB.startFocusSession(selectedTaskId || null, dur);
      setSessionId(data.id);
    } catch { /* ignore */ }
  };

  const startBreak = () => {
    setTimeLeft(BREAK_DURATION);
    setTotalDuration(BREAK_DURATION);
    setPaused(false);
    setPhase('break');
  };

  const skipBreak = () => {
    setPhase('idle');
  };

  const togglePause = () => {
    setPaused((prev) => !prev);
  };

  const cancelSession = async () => {
    clearInterval(intervalRef.current);
    if (sessionId) {
      try { await DB.cancelFocusSession(sessionId); } catch { /* ignore */ }
    }
    setPhase('idle');
    setSessionId(null);
    setTimeLeft(0);
    setPaused(false);
  };

  // Progress ring
  const progress = totalDuration > 0 ? (totalDuration - timeLeft) / totalDuration : 0;
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference * (1 - progress);

  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) : null;

  // Minimized pill (always visible when a session is active)
  if ((phase === 'focus' || phase === 'break') && !expanded) {
    return (
      <div className="focus-float">
        <button
          className={`focus-pill${phase === 'break' ? ' break' : ''}`}
          onClick={() => setExpanded(true)}
        >
          <span className="focus-pill-dot" />
          <span className="focus-pill-time">{formatTime(timeLeft)}</span>
          {paused && <span className="focus-pill-paused">||</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="focus-float" ref={panelRef}>
      {/* Toggle button (when idle / done) */}
      {phase === 'idle' && !expanded && (
        <button
          className="focus-toggle-btn"
          onClick={() => setExpanded(true)}
          title="Focus Timer (Shift+F)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {todayStats.sessions > 0 && (
            <span className="focus-toggle-badge">{todayStats.sessions}</span>
          )}
        </button>
      )}

      {/* Expanded panel */}
      {(expanded || phase === 'focus' || phase === 'break' || phase === 'done') && (
        <div className="focus-panel">
          {/* Header */}
          <div className="focus-panel-header">
            <span className="focus-panel-title">
              {phase === 'focus' ? 'Focusing' : phase === 'break' ? 'Break' : phase === 'done' ? 'Session Complete!' : 'Focus Timer'}
            </span>
            {phase === 'idle' && (
              <button className="focus-panel-close" onClick={() => setExpanded(false)}>
                &times;
              </button>
            )}
          </div>

          {/* Timer ring */}
          {(phase === 'focus' || phase === 'break') && (
            <div className="focus-ring-wrap">
              <svg className="focus-ring" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="var(--bg-3, #eee)" strokeWidth="4" />
                <circle
                  cx="40" cy="40" r="36"
                  fill="none"
                  stroke={phase === 'break' ? 'var(--accent, #4caf50)' : 'var(--primary, #2a5caa)'}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(-90 40 40)"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div className="focus-ring-time">{formatTime(timeLeft)}</div>
            </div>
          )}

          {/* Task label when focusing */}
          {phase === 'focus' && selectedTask && (
            <div className="focus-task-label" title={selectedTask.title}>
              {selectedTask.title}
            </div>
          )}

          {/* Controls for active session */}
          {(phase === 'focus' || phase === 'break') && (
            <div className="focus-controls">
              <button className="focus-ctrl-btn" onClick={togglePause}>
                {paused ? '\u25B6' : '\u23F8'}
              </button>
              <button className="focus-ctrl-btn danger" onClick={cancelSession} title="Cancel session">
                &times;
              </button>
            </div>
          )}

          {/* Done state */}
          {phase === 'done' && (
            <div className="focus-done">
              <div className="focus-done-icon">{'\u2705'}</div>
              <p>Great work! Take a break?</p>
              <div className="focus-done-actions">
                <button className="btn btn-primary" onClick={startBreak}>
                  5m Break
                </button>
                <button className="btn" onClick={skipBreak}>
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Idle: setup */}
          {phase === 'idle' && expanded && (
            <div className="focus-setup">
              {/* Task picker */}
              <div className="focus-field">
                <label>Focus on</label>
                <select
                  className="form-select"
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                >
                  <option value="">No specific task</option>
                  {activeTasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              {/* Duration presets */}
              <div className="focus-presets">
                {PRESETS.map((p) => (
                  <button
                    key={p.seconds}
                    className="focus-preset-btn"
                    onClick={() => startFocus(p.seconds)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Today's stats */}
              {todayStats.sessions > 0 && (
                <div className="focus-today-stats">
                  <span>{todayStats.sessions} session{todayStats.sessions !== 1 ? 's' : ''}</span>
                  <span className="focus-stats-dot" />
                  <span>{formatDuration(todayStats.totalSeconds)} focused today</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
