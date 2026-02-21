import { useState, useEffect, useRef } from 'react';
import { IconX } from './Icons';
import { useMentions, MentionDropdown } from '../mentions';
import { DB } from '../db';
import ItemComments from './ItemComments';

export default function NoteModal({ open, note, projects, tasks, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({ title: '', body: '', attachType: '', attachId: '' });
  const [allUsers, setAllUsers] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const bodyRef = useRef(null);
  const mentions = useMentions(allUsers, null);

  useEffect(() => {
    if (!open) return;
    if (note) {
      setForm({
        title: note.title,
        body: note.body,
        attachType: note.attachedTo ? note.attachedTo.type : '',
        attachId: note.attachedTo ? note.attachedTo.id : '',
      });
    } else {
      setForm({ title: '', body: '', attachType: '', attachId: '' });
    }
    setFieldErrors({});
  }, [open, note]);

  useEffect(() => {
    if (open && allUsers.length === 0) {
      DB.getUsers().then(setAllUsers).catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => {
    const errors = {};
    if (!form.title.trim() && !form.body.trim()) errors.title = 'Title or body is required';
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    onSave({ ...form, id: note?.id });
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
            <input className={`form-input${fieldErrors.title ? ' error' : ''}`} type="text" value={form.title} onChange={(e) => { set('title', e.target.value); if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: '' })); }} placeholder="Note title" />
            {fieldErrors.title && <div className="form-error">{fieldErrors.title}</div>}
          </div>
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Body <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>— use @ to mention users</span></label>
            <textarea
              ref={bodyRef}
              className={`form-textarea large${fieldErrors.title ? ' error' : ''}`}
              value={form.body}
              onChange={(e) => {
                set('body', e.target.value);
                mentions.detectMention(e.target.value, e.target.selectionStart);
                if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: '' }));
              }}
              placeholder="Write your note..."
            />
            <MentionDropdown mentions={mentions} onSelect={(username) => {
              const el = bodyRef.current;
              const newVal = mentions.insertMention(username, form.body, el?.selectionStart || form.body.length);
              set('body', newVal);
            }} />
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
