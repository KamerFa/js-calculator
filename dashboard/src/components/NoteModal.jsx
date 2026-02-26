import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { IconX } from './Icons';
import { useTheme } from '../context/ThemeContext';
import ItemComments from './ItemComments';

const NoteEditor = lazy(() => import('./notes/NoteEditor'));

function resolveTheme(mode) {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export default function NoteModal({ open, note, projects, tasks, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({ title: '', body: '', attachType: '', attachId: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const { mode } = useTheme();
  const bodyRef = useRef('');
  // Key to force re-mount the editor when a different note opens
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (note) {
      setForm({
        title: note.title,
        body: note.body || '',
        attachType: note.attachedTo ? note.attachedTo.type : '',
        attachId: note.attachedTo ? note.attachedTo.id : '',
      });
      bodyRef.current = note.body || '';
    } else {
      setForm({ title: '', body: '', attachType: '', attachId: '' });
      bodyRef.current = '';
    }
    setFieldErrors({});
    setEditorKey((k) => k + 1);
  }, [open, note]);

  if (!open) return null;

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleEditorChange = (jsonString) => {
    bodyRef.current = jsonString;
    set('body', jsonString);
  };

  const handleSave = () => {
    const body = bodyRef.current || form.body;
    const errors = {};
    if (!form.title.trim() && !body.trim()) errors.title = 'Title or body is required';
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    onSave({ ...form, body, id: note?.id });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{note ? 'Edit Note' : 'New Note'}</h2>
          <button className="modal-close" onClick={onClose}><IconX /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Title</label>
            <input
              className={`form-input${fieldErrors.title ? ' error' : ''}`}
              type="text"
              value={form.title}
              onChange={(e) => { set('title', e.target.value); if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: '' })); }}
              placeholder="Note title"
            />
            {fieldErrors.title && <div className="form-error">{fieldErrors.title}</div>}
          </div>
          <div className="form-group">
            <label>Body <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>— type / for commands</span></label>
            <Suspense fallback={<div className="form-textarea large" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>Loading editor...</div>}>
              <NoteEditor
                key={editorKey}
                content={bodyRef.current}
                onChange={handleEditorChange}
                theme={resolveTheme(mode)}
              />
            </Suspense>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Attach to</label>
              <select className="form-select" value={form.attachType} onChange={(e) => { set('attachType', e.target.value); set('attachId', ''); }}>
                <option value="">None (Standalone)</option>
                <option value="project">Project</option>
                <option value="task">Task</option>
              </select>
            </div>
            {form.attachType === 'project' && (
              <div className="form-group">
                <label>Project</label>
                <select className="form-select" value={form.attachId} onChange={(e) => set('attachId', e.target.value)}>
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            {form.attachType === 'task' && (
              <div className="form-group">
                <label>Task</label>
                <select className="form-select" value={form.attachId} onChange={(e) => set('attachId', e.target.value)}>
                  <option value="">Select task</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        {note && (
          <ItemComments targetType="note" targetId={note.id} />
        )}
        <div className="modal-footer">
          {note && (
            <button className="btn btn-danger" onClick={() => onDelete(note.id)} style={{ marginRight: 'auto' }}>Delete</button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
