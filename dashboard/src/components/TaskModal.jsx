import { useState, useEffect } from 'react';
import { IconX } from './Icons';

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'No repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function TaskModal({ open, task, projects, prefillProjectId, onSave, onClose }) {
  const [form, setForm] = useState(emptyForm());

  function emptyForm() {
    return { title: '', description: '', projectId: '', status: 'todo', priority: 'medium', dueDate: '', recurrence: 'none', customFields: [] };
  }

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        title: task.title,
        description: task.description || '',
        projectId: task.projectId || '',
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate || '',
        recurrence: task.recurrence || 'none',
        customFields: task.customFields ? task.customFields.map((f) => ({ ...f })) : [],
      });
    } else {
      const f = emptyForm();
      if (prefillProjectId) f.projectId = prefillProjectId;
      setForm(f);
    }
  }, [open, task, prefillProjectId]);

  if (!open) return null;

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const updateField = (index, key, value) => {
    setForm((prev) => {
      const fields = [...prev.customFields];
      fields[index] = { ...fields[index], [key]: value };
      return { ...prev, customFields: fields };
    });
  };

  const removeField = (index) => {
    setForm((prev) => ({ ...prev, customFields: prev.customFields.filter((_, i) => i !== index) }));
  };

  const addField = () => {
    setForm((prev) => ({ ...prev, customFields: [...prev.customFields, { key: '', value: '' }] }));
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave({ ...form, id: task?.id });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task ? 'Edit Task' : 'New Task'}</h2>
          <button className="modal-close" onClick={onClose}><IconX /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Title</label>
            <input className="form-input" type="text" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Task title" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea className="form-textarea" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional description" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Project</label>
              <select className="form-select" value={form.projectId} onChange={(e) => set('projectId', e.target.value)}>
                <option value="">No Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="todo">Todo</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Priority</label>
              <select className="form-select" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input className="form-input" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Repeat</label>
              <select className="form-select" value={form.recurrence} onChange={(e) => set('recurrence', e.target.value)}>
                {RECURRENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group" />
          </div>
          <div className="form-group">
            <label>Custom Fields</label>
            <div className="custom-fields-list">
              {form.customFields.map((field, i) => (
                <div className="custom-field-row" key={i}>
                  <input className="form-input" type="text" placeholder="Key" value={field.key} onChange={(e) => updateField(i, 'key', e.target.value)} />
                  <input className="form-input" type="text" placeholder="Value" value={field.value} onChange={(e) => updateField(i, 'value', e.target.value)} />
                  <button className="custom-field-remove" onClick={() => removeField(i)}>
                    <IconX size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button className="add-field-btn" onClick={addField}>+ Add field</button>
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
