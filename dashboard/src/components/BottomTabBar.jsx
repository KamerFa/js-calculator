import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { IconCheck, IconFile, IconCalendar, IconCommunity, IconMore, IconUsers, IconNews, IconRadio, IconFolder, IconUser, IconSettings, IconLogout, IconMessage } from './Icons';
import { useTranslation } from '../i18n';

const PRIMARY_TABS = [
  { key: 'tasks', path: '/', match: (p) => p === '/' },
  { key: 'calendar', path: '/calendar', match: (p) => p === '/calendar' },
  { key: 'notes', path: '/notes', match: (p) => p === '/notes' },
  { key: 'community', path: '/community', match: (p) => p === '/community' },
];

const TAB_ICONS = {
  tasks: <IconCheck />,
  calendar: <IconCalendar />,
  notes: <IconFile />,
  community: <IconCommunity />,
  more: <IconMore />,
};

export default function BottomTabBar({ onOpenSidebar, onLogout }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const pathname = location.pathname;

  const isPrimaryActive = PRIMARY_TABS.some((tab) => tab.match(pathname));

  const handleTabClick = (tab) => {
    setMoreOpen(false);
    navigate(tab.path);
  };

  const handleMoreClick = () => {
    setMoreOpen((prev) => !prev);
  };

  const handleSheetNav = (path) => {
    setMoreOpen(false);
    navigate(path);
  };

  const handleProjectsClick = () => {
    setMoreOpen(false);
    if (onOpenSidebar) onOpenSidebar();
  };

  const labels = {
    tasks: t('sidebar.tasks') || 'Tasks',
    calendar: t('sidebar.calendar') || 'Calendar',
    notes: t('sidebar.notes') || 'Notes',
    community: t('sidebar.community') || 'Community',
    more: t('sidebar.more') || 'More',
  };

  return (
    <>
      {moreOpen && <div className="bottom-sheet-backdrop" onClick={() => setMoreOpen(false)} />}

      {moreOpen && (
        <div className="bottom-sheet">
          <div className="bottom-sheet-handle" />
          <div className="bottom-sheet-grid">
            <button
              className={`bottom-sheet-item${pathname.startsWith('/messages') ? ' active' : ''}`}
              onClick={() => handleSheetNav('/messages')}
            >
              <IconMessage />
              <span>{t('sidebar.messages') || 'Messages'}</span>
            </button>
            <button
              className={`bottom-sheet-item${pathname === '/users' ? ' active' : ''}`}
              onClick={() => handleSheetNav('/users')}
            >
              <IconUsers />
              <span>{t('community.users') || 'Users'}</span>
            </button>
            <button
              className={`bottom-sheet-item${pathname === '/news' ? ' active' : ''}`}
              onClick={() => handleSheetNav('/news')}
            >
              <IconNews />
              <span>News</span>
            </button>
            <button
              className={`bottom-sheet-item${pathname === '/radio' ? ' active' : ''}`}
              onClick={() => handleSheetNav('/radio')}
            >
              <IconRadio />
              <span>Radio</span>
            </button>
            <button
              className={`bottom-sheet-item${pathname.startsWith('/project/') ? ' active' : ''}`}
              onClick={handleProjectsClick}
            >
              <IconFolder />
              <span>{t('sidebar.projects') || 'Projects'}</span>
            </button>
            <button
              className={`bottom-sheet-item${pathname === '/profile' ? ' active' : ''}`}
              onClick={() => handleSheetNav('/profile')}
            >
              <IconUser />
              <span>{t('sidebar.profile') || 'Profile'}</span>
            </button>
            <button
              className={`bottom-sheet-item${pathname === '/settings' ? ' active' : ''}`}
              onClick={() => handleSheetNav('/settings')}
            >
              <IconSettings />
              <span>{t('sidebar.settings') || 'Settings'}</span>
            </button>
          </div>
        </div>
      )}

      <nav className="bottom-tab-bar">
        {PRIMARY_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`bottom-tab${tab.match(pathname) ? ' active' : ''}`}
            onClick={() => handleTabClick(tab)}
          >
            {TAB_ICONS[tab.key]}
            <span className="bottom-tab-label">{labels[tab.key]}</span>
          </button>
        ))}
        <button
          className={`bottom-tab${!isPrimaryActive || moreOpen ? ' active' : ''}`}
          onClick={handleMoreClick}
        >
          {TAB_ICONS.more}
          <span className="bottom-tab-label">{labels.more}</span>
        </button>
      </nav>
    </>
  );
}
