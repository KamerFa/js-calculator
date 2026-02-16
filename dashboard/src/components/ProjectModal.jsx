import { useState, useEffect } from 'react';
import { IconX } from './Icons';

const PRESET_COLORS = ['#2a5caa', '#c0392b', '#276749', '#b45309', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#6366f1', '#78716c'];

export default function ProjectModal({ open, project, onSave, onClose }) {
  const [form, setForm] = useState({ name: '', description: '', color: PRESET_COLORS[0] });

  useEffect(() => {
    if (!open) return;
    if (project) {
      setForm({ name: project.name, description: project.description || '', color: project.color });
    } else {
      setForm({ name: '', description: '', color: PRESET_COLORS[0] });
    }
  }, [open, project]);

  if (!open) return null;

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({ ...form, id: project?.id });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{project ? 'Edit Project' : 'New Project'}</h2>
          <button className="modal-close" onClick={onClose}><IconX /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Name</label>
            <input className="form-input" type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Project name" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea className="form-textarea" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional description" />
          </div>
          <div className="form-group">
            <label>Color</label>
            <div className="color-swatches">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={`color-swatch${form.color === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => set('color', c)}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
