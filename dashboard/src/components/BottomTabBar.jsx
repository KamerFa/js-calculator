import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { IconCheck, IconFile, IconCalendar, IconCommunity, IconMore, IconUsers, IconNews, IconRadio, IconFolder, IconUser, IconSettings, IconMessage } from './Icons';
import { useTranslation } from '../i18n';

const PRIMARY_TABS = [
  { key: 'tasks', path: '/', match: (p) => p === '/' },
  { key: 'projects', path: '/projects', match: (p) => p === '/projects' || p.startsWith('/project/') },
  { key: 'calendar', path: '/calendar', match: (p) => p === '/calendar' },
  { key: 'messages', path: '/messages', match: (p) => p.startsWith('/messages') },
];

const TAB_ICONS = {
  tasks: <IconCheck />,
  projects: <IconFolder />,
  calendar: <IconCalendar />,
  messages: <IconMessage />,
  more: <IconMore />,
};

export default function BottomTabBar({ onLogout }) {
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

  const labels = {
    tasks: t('sidebar.tasks') || 'Tasks',
    projects: t('sidebar.projects') || 'Projects',
    calendar: t('sidebar.calendar') || 'Calendar',
    messages: t('sidebar.messages') || 'Messages',
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
              className={`bottom-sheet-item${pathname === '/notes' ? ' active' : ''}`}
              onClick={() => handleSheetNav('/notes')}
            >
              <IconFile />
              <span>{t('sidebar.notes') || 'Notes'}</span>
            </button>
            <button
              className={`bottom-sheet-item${pathname === '/community' ? ' active' : ''}`}
              onClick={() => handleSheetNav('/community')}
            >
              <IconCommunity />
              <span>{t('sidebar.community') || 'Community'}</span>
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
