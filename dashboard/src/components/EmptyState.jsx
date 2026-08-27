import { memo } from 'react';

const EmptyState = memo(function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      {title && <p className="empty-state-title">{title}</p>}
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
});

export default EmptyState;
