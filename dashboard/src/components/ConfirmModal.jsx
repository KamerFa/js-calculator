export default function ConfirmModal({ open, message, onConfirm, onClose }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Confirmation">
      <div className="modal-card" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="confirm-body">
          <p>{message}</p>
          <div className="confirm-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-danger" onClick={() => { onConfirm(); onClose(); }}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}
