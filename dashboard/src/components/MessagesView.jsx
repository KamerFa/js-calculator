import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { DB } from '../db';
import { useTranslation } from '../i18n';
import { resolveAvatarUrl } from '../avatarUtils';
import StatusDot from './StatusDot';
import { IconMessage, IconArrowLeft, IconSend, IconPlus } from './Icons';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateSeparatorLabel(iso, t) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return t('messages.today');
  if (d.toDateString() === yesterday.toDateString()) return t('messages.yesterday');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function shouldShowDateSep(msgs, idx) {
  if (idx === 0) return true;
  const prev = new Date(msgs[idx - 1].createdAt).toDateString();
  const curr = new Date(msgs[idx].createdAt).toDateString();
  return prev !== curr;
}

function isGrouped(msgs, idx) {
  if (idx === 0) return false;
  const prev = msgs[idx - 1];
  const curr = msgs[idx];
  const sameSender = (prev.senderId || prev.userId) === (curr.senderId || curr.userId);
  const within2min = new Date(curr.createdAt) - new Date(prev.createdAt) < 120000;
  const sameDay = new Date(prev.createdAt).toDateString() === new Date(curr.createdAt).toDateString();
  return sameSender && within2min && sameDay;
}

export default function MessagesView({ user, onUserClick }) {
  const { t } = useTranslation();
  const { userId: paramUserId } = useParams();
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null); // { type: 'dm'|'project', id }
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [friends, setFriends] = useState([]);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load conversations
  const loadConversations = async () => {
    try {
      const data = await DB.getConversations();
      setConversations(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  // Deep link: auto-select DM from URL param
  useEffect(() => {
    if (paramUserId && !selectedConv) {
      setSelectedConv({ type: 'dm', id: paramUserId });
    }
  }, [paramUserId]);

  // Load messages for selected conversation
  const loadMessages = async () => {
    if (!selectedConv) return;
    try {
      let data;
      if (selectedConv.type === 'dm') {
        data = await DB.getDMs(selectedConv.id);
        await DB.markDMRead(selectedConv.id);
      } else {
        data = await DB.getProjectMessages(selectedConv.id);
        await DB.markProjectChatRead(selectedConv.id);
      }
      setMessages(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (selectedConv) {
      loadMessages();
      const interval = setInterval(loadMessages, 5000);
      return () => clearInterval(interval);
    } else {
      setMessages([]);
    }
  }, [selectedConv?.type, selectedConv?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input on conversation select
  useEffect(() => {
    if (selectedConv) inputRef.current?.focus();
  }, [selectedConv?.type, selectedConv?.id]);

  const handleSend = async () => {
    if (!body.trim() || sending || !selectedConv) return;
    setSending(true);
    try {
      if (selectedConv.type === 'dm') {
        await DB.sendDM(selectedConv.id, body.trim());
      } else {
        await DB.postProjectMessage(selectedConv.id, body.trim());
      }
      setBody('');
      await loadMessages();
      await loadConversations();
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (msgId) => {
    if (selectedConv.type === 'dm') {
      await DB.deleteDM(msgId);
    } else {
      await DB.deleteProjectMessage(selectedConv.id, msgId);
    }
    await loadMessages();
  };

  const handleSelectConv = (conv) => {
    if (conv.type === 'dm') {
      setSelectedConv({ type: 'dm', id: conv.userId });
    } else {
      setSelectedConv({ type: 'project', id: conv.projectId });
    }
  };

  const handleNewDM = async (friendId) => {
    setShowFriendPicker(false);
    setFriendSearch('');
    setSelectedConv({ type: 'dm', id: friendId });
  };

  const openFriendPicker = async () => {
    try {
      const data = await DB.getFriends();
      setFriends(data.filter(f => f.status === 'accepted'));
    } catch { /* ignore */ }
    setShowFriendPicker(true);
  };

  // Get display info for active conversation
  const activeConvInfo = selectedConv
    ? conversations.find(c =>
        selectedConv.type === 'dm'
          ? c.type === 'dm' && c.userId === selectedConv.id
          : c.type === 'project' && c.projectId === selectedConv.id
      )
    : null;

  // Filtered conversations
  const filteredConvs = search
    ? conversations.filter(c => {
        const name = c.type === 'dm' ? c.username : c.projectName;
        return name.toLowerCase().includes(search.toLowerCase());
      })
    : conversations;

  const filteredFriends = friendSearch
    ? friends.filter(f => f.username.toLowerCase().includes(friendSearch.toLowerCase()))
    : friends;

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;

  return (
    <div className="messages-layout">
      {/* ── Left panel: Conversation list ── */}
      <div className={`messages-sidebar${selectedConv && isMobile ? ' hidden-mobile' : ''}`}>
        <div className="messages-sidebar-header">
          <h2>{t('messages.title')}</h2>
          <button className="btn btn-sm btn-primary" onClick={openFriendPicker} title={t('messages.newMessage')}>
            <IconPlus size={12} />
          </button>
        </div>

        <div className="messages-search-wrap">
          <input
            type="text"
            className="form-input messages-search"
            placeholder={t('messages.searchConversations')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="conv-list">
          {loading && <div className="conv-empty">{t('common.loading')}</div>}
          {!loading && filteredConvs.length === 0 && (
            <div className="conv-empty">{t('messages.noConversations')}</div>
          )}
          {filteredConvs.map((conv) => {
            const isActive = selectedConv && (
              (conv.type === 'dm' && selectedConv.type === 'dm' && conv.userId === selectedConv.id) ||
              (conv.type === 'project' && selectedConv.type === 'project' && conv.projectId === selectedConv.id)
            );
            const key = conv.type === 'dm' ? `dm-${conv.userId}` : `proj-${conv.projectId}`;

            return (
              <button
                key={key}
                className={`conv-item${isActive ? ' active' : ''}${conv.unreadCount > 0 ? ' unread' : ''}`}
                onClick={() => handleSelectConv(conv)}
              >
                <div className="conv-avatar">
                  {conv.type === 'dm' ? (
                    <>
                      {resolveAvatarUrl(conv.avatarUrl)
                        ? <img src={resolveAvatarUrl(conv.avatarUrl)} alt="" className="conv-avatar-img" />
                        : <span className="conv-avatar-placeholder">{conv.username.charAt(0).toUpperCase()}</span>
                      }
                      <StatusDot
                        presence={conv.presence}
                        size={8}
                        style={{ position: 'absolute', bottom: 0, right: 0, border: '2px solid var(--surface)', borderRadius: '50%', boxSizing: 'content-box' }}
                      />
                    </>
                  ) : (
                    <span className="conv-avatar-project" style={{ background: conv.projectColor || 'var(--accent)' }}>#</span>
                  )}
                </div>
                <div className="conv-body">
                  <div className="conv-meta">
                    <span className="conv-name">
                      {conv.type === 'dm' ? conv.username : conv.projectName}
                    </span>
                    <span className="conv-time">{timeAgo(conv.lastMessage.createdAt)}</span>
                  </div>
                  <div className="conv-preview">
                    {conv.type === 'project' && conv.lastMessage.username && (
                      <span className="conv-preview-sender">{conv.lastMessage.username}: </span>
                    )}
                    {conv.type === 'dm' && conv.lastMessage.senderId === user?.id && (
                      <span className="conv-preview-sender">{t('messages.you')}: </span>
                    )}
                    {conv.lastMessage.body.slice(0, 50)}
                  </div>
                </div>
                {conv.unreadCount > 0 && (
                  <span className="conv-unread-badge">{conv.unreadCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right panel: Message thread ── */}
      <div className={`messages-main${!selectedConv && isMobile ? ' hidden-mobile' : ''}`}>
        {!selectedConv ? (
          <div className="messages-empty">
            <IconMessage />
            <p>{t('messages.selectConversation')}</p>
          </div>
        ) : (
          <>
            <div className="messages-header">
              <button className="messages-back-btn" onClick={() => setSelectedConv(null)}>
                <IconArrowLeft />
              </button>
              <div className="messages-header-info">
                {activeConvInfo?.type === 'dm' ? (
                  <>
                    <span className="messages-header-name" onClick={() => onUserClick && onUserClick(activeConvInfo.username)} style={{ cursor: 'pointer' }}>
                      {activeConvInfo.username}
                    </span>
                    <span className={`messages-header-status messages-status-${activeConvInfo.presence}`}>
                      {t(`messages.${activeConvInfo.presence === 'active' ? 'online' : activeConvInfo.presence === 'away' ? 'away' : 'offline'}`)}
                    </span>
                  </>
                ) : activeConvInfo?.type === 'project' ? (
                  <span className="messages-header-name">
                    <span className="conv-hash" style={{ color: activeConvInfo.projectColor }}>#</span>
                    {activeConvInfo.projectName}
                  </span>
                ) : (
                  <span className="messages-header-name">{t('messages.title')}</span>
                )}
              </div>
            </div>

            <div className="messages-thread">
              {messages.length === 0 && (
                <div className="messages-thread-empty">{t('messages.noMessages')}</div>
              )}
              {messages.map((msg, idx) => {
                const senderId = msg.senderId || msg.userId;
                const isMine = senderId === user?.id;
                const grouped = isGrouped(messages, idx);
                const showDate = shouldShowDateSep(messages, idx);

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="messages-date-sep">
                        <span>{dateSeparatorLabel(msg.createdAt, t)}</span>
                      </div>
                    )}
                    <div className={`msg-row${isMine ? ' mine' : ''}${grouped ? ' grouped' : ''}`}>
                      {!isMine && !grouped && (
                        <div className="msg-avatar" onClick={() => onUserClick && onUserClick(msg.username)} style={{ cursor: 'pointer' }}>
                          {resolveAvatarUrl(msg.avatarUrl)
                            ? <img src={resolveAvatarUrl(msg.avatarUrl)} alt="" className="msg-avatar-img" />
                            : <span className="msg-avatar-placeholder">{msg.username?.charAt(0).toUpperCase()}</span>
                          }
                        </div>
                      )}
                      {!isMine && grouped && <div className="msg-avatar-spacer" />}
                      <div className="msg-content">
                        {!grouped && !isMine && (
                          <span className="msg-sender" onClick={() => onUserClick && onUserClick(msg.username)}>
                            {msg.username}
                          </span>
                        )}
                        <div className={`msg-bubble${isMine ? ' mine' : ''}`}>
                          <span className="msg-text">{msg.body}</span>
                          <span className="msg-time">{formatTime(msg.createdAt)}</span>
                          {isMine && (
                            <button className="msg-delete" onClick={() => handleDelete(msg.id)} title={t('messages.deleteMessage')}>
                              &times;
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="messages-compose">
              <input
                ref={inputRef}
                className="form-input messages-input"
                type="text"
                placeholder={t('messages.typeMessage')}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                maxLength={selectedConv?.type === 'dm' ? 2000 : 1000}
              />
              <button className="messages-send-btn" disabled={!body.trim() || sending} onClick={handleSend}>
                <IconSend />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Friend picker modal ── */}
      {showFriendPicker && (
        <>
          <div className="friend-picker-backdrop" onClick={() => { setShowFriendPicker(false); setFriendSearch(''); }} />
          <div className="friend-picker-modal">
            <h3>{t('messages.chooseFriend')}</h3>
            <input
              type="text"
              className="form-input"
              placeholder={t('messages.searchConversations')}
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              autoFocus
            />
            <div className="friend-picker-list">
              {filteredFriends.length === 0 && (
                <div className="friend-picker-empty">{t('messages.noFriends')}</div>
              )}
              {filteredFriends.map((f) => (
                <button key={f.id} className="friend-picker-item" onClick={() => handleNewDM(f.id)}>
                  <div className="conv-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                    {resolveAvatarUrl(f.avatarUrl)
                      ? <img src={resolveAvatarUrl(f.avatarUrl)} alt="" className="conv-avatar-img" />
                      : <span className="conv-avatar-placeholder">{f.username.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <span>{f.username}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
