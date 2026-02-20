import { IconPlus } from './Icons';
import { formatDate } from '../utils/time';

export default function NotesView({ notes, projects, tasks, onNoteClick, onNewNote }) {

  const attachmentLabel = (note) => {
    if (!note.attachedTo) return 'Standalone';
    if (note.attachedTo.type === 'project') {
      const p = projects.find((pr) => pr.id === note.attachedTo.id);
      return p ? p.name : 'Standalone';
    }
    if (note.attachedTo.type === 'task') {
      const t = tasks.find((tk) => tk.id === note.attachedTo.id);
      return t ? t.title : 'Standalone';
    }
    return 'Standalone';
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Notes</h1>
            <p className="subtitle">{notes.length} notes</p>
          </div>
        </div>
      </div>

      <div className="notes-grid">
        <button className="note-add-card" onClick={onNewNote}>
          <IconPlus size={28} />
          Add Note
        </button>
        {notes.map((note) => (
          <div className="note-card" key={note.id} onClick={() => onNoteClick(note)}>
            <div className="note-card-title">{note.title || 'Untitled'}</div>
            <div className="note-card-body">{note.body}</div>
            <div className="note-card-meta">
              <span>{formatDate(note.updatedAt)}</span>
              <span className="note-attachment-tag">{attachmentLabel(note)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
