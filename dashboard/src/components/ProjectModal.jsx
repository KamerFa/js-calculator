import { useState, useEffect } from 'react';
import { IconX } from './Icons';
import { useTranslation } from '../i18n';

const PRESET_COLORS = ['#2a5caa', '#c0392b', '#276749', '#b45309', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#6366f1', '#78716c'];

// Normalize date value to YYYY-MM-DD for HTML date input
function toDateInput(val) {
  if (!val) return '';
  const s = typeof val === 'string' ? val : new Date(val).toISOString();
  return s.slice(0, 10);
}

export default function ProjectModal({ open, project, onSave, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', description: '', color: PRESET_COLORS[0], isPublic: false, startDate: '', endDate: '' });
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    if (project) {
      setForm({
        name: project.name,
        description: project.description || '',
        color: project.color,
        isPublic: project.isPublic || false,
        startDate: toDateInput(project.startDate),
        endDate: toDateInput(project.endDate)
      });
    } else {
      setForm({ name: '', description: '', color: PRESET_COLORS[0], isPublic: false, startDate: '', endDate: '' });
    }
    setFieldErrors({});
  }, [open, project]);

  if (!open) return null;

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    onSave({ ...form, id: project?.id });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{project ? t('projects.editProject') : t('projects.newProject')}</h2>
          <button className="modal-close" onClick={onClose}><IconX /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>{t('projects.name')}</label>
            <input className={`form-input${fieldErrors.name ? ' error' : ''}`} type="text" value={form.name} onChange={(e) => { set('name', e.target.value); if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' })); }} placeholder={t('projects.name')} />
            {fieldErrors.name && <div className="form-error">{fieldErrors.name}</div>}
          </div>
          <div className="form-group">
            <label>{t('projects.description')}</label>
            <textarea className="form-textarea" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder={t('projects.description')} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('projects.startDate')}</label>
              <input className="form-input" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('projects.endDate')}</label>
              <input className="form-input" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>{t('projects.color')}</label>
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
          <div className="form-group" style={{ position: 'relative', overflow: 'visible' }}>
            <label className="toggle-row" onClick={() => set('isPublic', !form.isPublic)}>
              <span className={`toggle-switch${form.isPublic ? ' on' : ''}`}>
                <span className="toggle-knob" />
              </span>
              <span className="toggle-label">
                <span>{t('projects.shareWithCommunity')}</span>
                <span className="toggle-hint">
                  {form.isPublic ? t('projects.publicHint') : t('projects.privateHint')}
                </span>
              </span>
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{t('modal.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave}>{t('modal.save')}</button>
        </div>
      </div>
    </div>
  );
}
