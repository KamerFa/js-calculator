import { useState } from 'react';
import { IconX } from './Icons';

const EXAMPLE_JSON = `{
  "name": "Ramazan 2026",
  "description": "Prati svoj post, ibadet i dobra djela tokom Ramazana",
  "color": "#1a7a4c",
  "startDate": "2026-02-17",
  "endDate": "2026-03-22",
  "isPublic": true,
  "tasks": [
    {
      "title": "Post od sehura do iftara",
      "description": "Drzi obavezni post od zore do zalaska sunca",
      "priority": "high",
      "recurrence": "daily"
    },
    {
      "title": "Teravija namaz",
      "description": "Klanjaj teraviju poslije jacije",
      "priority": "high",
      "recurrence": "daily"
    },
    {
      "title": "Zekat ul-fitr",
      "description": "Izdvoj zekat ul-fitr prije bajram-namaza",
      "priority": "high",
      "recurrence": "none",
      "dueDate": "2026-03-19"
    }
  ]
}`;

const TEMPLATE_PROMPT = `Napravi mi projekat u ovom JSON formatu. Projekat treba da ima name, description, color (hex), startDate, endDate, isPublic (true/false), i niz tasks. Svaki task ima title, description, priority (high/medium/low), recurrence (daily/weekly/monthly/none), i opcionalno dueDate (YYYY-MM-DD).

Evo primjer formata:
${EXAMPLE_JSON}

Napravi mi projekat za: [OPISI STA ZELIS]`;

export default function ImportProjectModal({ open, onImport, onClose }) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState('');

  if (!open) return null;

  const copyExample = () => {
    navigator.clipboard.writeText(EXAMPLE_JSON);
    setCopied('example');
    setTimeout(() => setCopied(''), 2000);
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(TEMPLATE_PROMPT);
    setCopied('prompt');
    setTimeout(() => setCopied(''), 2000);
  };

  const handleParse = () => {
    setError('');
    setPreview(null);
    try {
      const data = JSON.parse(jsonText.trim());
      if (!data.name?.trim()) throw new Error('Nedostaje "name" polje');
      if (!Array.isArray(data.tasks) || data.tasks.length === 0) throw new Error('Nedostaje "tasks" niz ili je prazan');
      if (data.tasks.length > 100) throw new Error('Maksimalno 100 taskova');
      for (let i = 0; i < data.tasks.length; i++) {
        if (!data.tasks[i].title?.trim()) throw new Error(`Task #${i + 1} nema "title"`);
      }
      setPreview(data);
    } catch (e) {
      if (e instanceof SyntaxError) {
        setError('Neispravan JSON format. Provjeri da li je sve korektno kopirano.');
      } else {
        setError(e.message);
      }
    }
  };

  const handleImport = async () => {
    if (!preview || importing) return;
    setImporting(true);
    setError('');
    try {
      await onImport(preview);
    } catch (e) {
      setError(e.message || 'Import nije uspio');
      setImporting(false);
    }
  };

  const handleClose = () => {
    setJsonText('');
    setError('');
    setPreview(null);
    setImporting(false);
    setCopied('');
    onClose();
  };

  const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
  const REC_LABELS = { daily: 'Dnevno', weekly: 'Sedmicno', monthly: 'Mjesecno', none: '' };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Importuj Projekat</h2>
          <button className="modal-close" onClick={handleClose}><IconX /></button>
        </div>
        <div className="modal-body">
          {!preview ? (
            <>
              <p className="import-instructions">
                Kopiraj JSON strukturu i daj je AI modelu (ChatGPT, Gemini, Claude) da ti generiše projekat, zatim zalijepi rezultat ovdje.
              </p>

              <div className="import-actions-row">
                <button className="btn btn-sm" onClick={copyExample}>
                  {copied === 'example' ? 'Kopirano!' : 'Kopiraj primjer JSON'}
                </button>
                <button className="btn btn-sm btn-primary" onClick={copyPrompt}>
                  {copied === 'prompt' ? 'Kopirano!' : 'Kopiraj prompt za AI'}
                </button>
              </div>

              <div className="form-group">
                <label>Zalijepi JSON ovdje</label>
                <textarea
                  className="form-textarea import-textarea"
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder='{"name": "Moj Projekat", "tasks": [...]}'
                  spellCheck={false}
                />
              </div>

              {error && <div className="import-error">{error}</div>}
            </>
          ) : (
            <div className="import-preview">
              <div className="import-preview-header">
                <div className="import-preview-color" style={{ background: preview.color || '#2a5caa' }} />
                <div>
                  <h3>{preview.name}</h3>
                  {preview.description && <p className="import-preview-desc">{preview.description}</p>}
                </div>
              </div>

              <div className="import-preview-meta">
                {preview.startDate && <span>Od: {preview.startDate}</span>}
                {preview.endDate && <span>Do: {preview.endDate}</span>}
                {preview.isPublic && <span className="import-public-tag">Javni</span>}
                <span>{preview.tasks.length} taskova</span>
              </div>

              <div className="import-preview-tasks">
                {preview.tasks.map((t, i) => (
                  <div className="import-preview-task" key={i}>
                    <span className="import-task-title">{t.title}</span>
                    <span className="priority-badge" style={{ background: (PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.medium) + '18', color: PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.medium }}>
                      {t.priority || 'medium'}
                    </span>
                    {t.recurrence && t.recurrence !== 'none' && (
                      <span className="recurrence-badge">{REC_LABELS[t.recurrence]}</span>
                    )}
                    {t.dueDate && <span className="import-task-due">{t.dueDate}</span>}
                  </div>
                ))}
              </div>

              {error && <div className="import-error">{error}</div>}
            </div>
          )}
        </div>
        <div className="modal-footer">
          {!preview ? (
            <>
              <button className="btn" onClick={handleClose}>Zatvori</button>
              <button className="btn btn-primary" onClick={handleParse} disabled={!jsonText.trim()}>Parsiraj</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setPreview(null)}>Nazad</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                {importing ? 'Importujem...' : `Importuj (${preview.tasks.length} taskova)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
