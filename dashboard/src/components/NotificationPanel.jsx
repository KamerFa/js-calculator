import { useState, useEffect, useRef } from 'react';
import { DB } from '../db';
import { resolveAvatarUrl } from '../avatarUtils';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const TYPE_ICONS = {
  tweet_reaction: '\u2764\uFE0F',
  tweet_comment: '\uD83D\uDCAC',
  task_created: '\u2795',
  task_completed: '\u2705',
  task_status: '\uD83D\uDD04',
  project_join: '\uD83D\uDC4B',
  project_leave: '\uD83D\uDEAA',
  project_invite: '\uD83D\uDCE8',
  project_removed: '\u274C',
};

export default function NotificationPanel({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  const loadUnread = async () => {
    try {
      const { count } = await DB.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // ignore
    }
  };

  const loadNotifications = async () => {
    try {
      const data = await DB.getNotifications();
      setNotifications(data);
      const unread = data.filter((n) => !n.isRead).length;
      setUnreadCount(unread);
    } catch {
      // ignore
    }
  };

  // Poll unread count every 30s
  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load full list when opening
  useEffect(() => {
    if (open) loadNotifications();
  }, [open]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleMarkAllRead = async () => {
    await DB.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await DB.markNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    // Navigate based on type
    if (notif.targetType === 'tweet') {
      onNavigate('community');
    } else if (notif.targetType === 'project') {
      onNavigate('project', notif.targetId);
    } else if (notif.targetType === 'task') {
      onNavigate('tasks');
    }
    setOpen(false);
  };

  return (
    <div className="notif-wrapper" ref={panelRef}>
      <button className="notif-bell" onClick={() => setOpen(!open)} title="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>
            {unreadCount > 0 && (
              <button className="notif-mark-all" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-panel-list">
            {notifications.length === 0 && (
              <div className="notif-empty">No notifications yet</div>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`notif-item${n.isRead ? '' : ' notif-unread'}`}
                onClick={() => handleNotificationClick(n)}
              >
                <span className="notif-item-icon">
                  {TYPE_ICONS[n.type] || '\uD83D\uDD14'}
                </span>
                <div className="notif-item-body">
                  <span className="notif-item-summary">{n.summary}</span>
                  <span className="notif-item-time">{timeAgo(n.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
