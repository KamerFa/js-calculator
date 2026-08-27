import { useState, useRef } from 'react';
import { IconPlus, IconEdit, IconTrash } from './Icons';
import { formatDate } from '../utils/time';

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: '#5b9aef' },
  { id: 'in-progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'done', label: 'Done', color: '#22c55e' },
];

const EFFORT_LABELS = { easy: 'Easy', medium: 'Med', hard: 'Hard', epic: 'Epic' };
const EFFORT_COLORS = { easy: '#5b9aef', medium: '#f59e0b', hard: '#ec4899', epic: '#a855f7' };

export default function ProjectKanban({ tasks, currentUserId, isShared, onToggle, onClick, onEdit, onDelete, onNewTask, onStatusChange }) {
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const dragCounters = useRef({});

  const handleDragStart = (e, taskId) => {
    setDragId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    // Slight delay for visual feedback
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-kanban-id="${taskId}"]`);
      if (el) el.classList.add('kb-dragging');
    });
  };

  const handleDragEnd = () => {
    if (dragId) {
      const el = document.querySelector(`[data-kanban-id="${dragId}"]`);
      if (el) el.classList.remove('kb-dragging');
    }
    setDragId(null);
    setOverCol(null);
    dragCounters.current = {};
  };

  const handleDragEnter = (e, colId) => {
    e.preventDefault();
    dragCounters.current[colId] = (dragCounters.current[colId] || 0) + 1;
    setOverCol(colId);
  };

  const handleDragLeave = (colId) => {
    dragCounters.current[colId] = (dragCounters.current[colId] || 0) - 1;
    if (dragCounters.current[colId] <= 0) {
      dragCounters.current[colId] = 0;
      if (overCol === colId) setOverCol(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, colId) => {
    e.preventDefault();
    dragCounters.current = {};
    setOverCol(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === colId) return;
    onStatusChange(task, colId);
  };

  return (
    <div className="kb">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.id);
        const isOver = overCol === col.id && dragId && tasks.find(t => t.id === dragId)?.status !== col.id;

        return (
          <div
            className={`kb-col${isOver ? ' kb-col-over' : ''}`}
            key={col.id}
            onDragEnter={(e) => handleDragEnter(e, col.id)}
            onDragLeave={() => handleDragLeave(col.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="kb-col-header">
              <span className="kb-col-dot" style={{ background: col.color }} />
              <span className="kb-col-label">{col.label}</span>
              <span className="kb-col-count">{colTasks.length}</span>
              {col.id === 'todo' && (
                <button className="kb-add-btn" onClick={onNewTask} title="New task">
                  <IconPlus />
                </button>
              )}
            </div>

            <div className="kb-cards">
              {colTasks.map(task => {
                const isOwnTask = !currentUserId || task.userId === currentUserId;
                const effectiveDate = task.dueDate || task.scheduledDate;
                const isOverdue = task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date(new Date().toISOString().split('T')[0]);

                return (
                  <div
                    className="kb-card"
                    key={task.id}
                    data-kanban-id={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onClick(task)}
                  >
                    <div className="kb-card-title">{task.title}</div>

                    <div className="kb-card-meta">
                      {task.priority && (
                        <span className={`kb-badge kb-priority-${task.priority}`}>{task.priority}</span>
                      )}
                      {task.effort && task.effort !== 'medium' && (
                        <span className="kb-badge" style={{ color: EFFORT_COLORS[task.effort], background: EFFORT_COLORS[task.effort] + '18' }}>
                          {EFFORT_LABELS[task.effort]}
                        </span>
                      )}
                      {effectiveDate && (
                        <span className={`kb-date${isOverdue ? ' kb-overdue' : ''}`}>
                          {formatDate(effectiveDate)}
                        </span>
                      )}
                      {isShared && task.creatorUsername && (
                        <span className="kb-creator">@{task.creatorUsername}</span>
                      )}
                    </div>

                    {isOwnTask && (
                      <div className="kb-card-actions">
                        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(task); }} title="Edit">
                          <IconEdit />
                        </button>
                        <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(task); }} title="Delete">
                          <IconTrash />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {colTasks.length === 0 && (
                <div className="kb-empty">
                  {col.id === 'todo' ? 'No tasks yet' : col.id === 'in-progress' ? 'Nothing in progress' : 'Nothing done yet'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
