import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { DB } from '../db';
import { useTranslation } from '../i18n';
import { resolveAvatarUrl } from '../avatarUtils';
import StatusDot from './StatusDot';
import { IconMessage, IconArrowLeft, IconSend, IconPlus, IconReply } from './Icons';
import { initMessageSoundContext, playMessageSound } from '../messageSound';

const REACTION_EMOJIS = [
  '\u2764\uFE0F','😂','🙏','🔥','👍','😢','👏','😍','🤯','🚀','🎉','🤔','✅','💯','👀','🤡','💩','☕',
];

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

function renderBody(body, onUserClick) {
  const parts = body.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <span
          key={i}
          className="chat-mention"
          onClick={() => onUserClick?.(username)}
        >
          {part}
        </span>
      );
    }
    return part;
  });
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
  const [showReactPickerForMsg, setShowReactPickerForMsg] = useState(null);
  const [reactorsPopup, setReactorsPopup] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const prevUnreadRef = useRef({});
  const selectedConvRef = useRef(null);

  // Seen/delivered state
  const [otherReadAt, setOtherReadAt] = useState(null);

  // @Mention state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [channelMembers, setChannelMembers] = useState([]);

  // Thread panel state
  const [threadParentId, setThreadParentId] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadParent, setThreadParent] = useState(null);
  const [threadBody, setThreadBody] = useState('');
  const [threadSending, setThreadSending] = useState(false);
  const [alsoSendToChannel, setAlsoSendToChannel] = useState(false);
  const [showThreadReactPickerForMsg, setShowThreadReactPickerForMsg] = useState(null);
  const threadEndRef = useRef(null);
  const threadInputRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);

  // Init AudioContext on first user interaction
  useEffect(() => {
    const init = () => {
      initMessageSoundContext();
      document.removeEventListener('click', init);
      document.removeEventListener('keydown', init);
    };
    document.addEventListener('click', init);
    document.addEventListener('keydown', init);
    return () => {
      document.removeEventListener('click', init);
      document.removeEventListener('keydown', init);
    };
  }, []);

  // Load conversations
  const loadConversations = async () => {
    try {
      const data = await DB.getConversations();

      // Detect new messages for sound notification
      if (!loading) {
        const sc = selectedConvRef.current;
        for (const conv of data) {
          const key = conv.type === 'dm' ? `dm-${conv.userId}` : `proj-${conv.projectId}`;
          const prevUnread = prevUnreadRef.current[key] || 0;
          const isActiveConv = sc && (
            (conv.type === 'dm' && sc.type === 'dm' && conv.userId === sc.id) ||
            (conv.type === 'project' && sc.type === 'project' && conv.projectId === sc.id)
          );
          if (conv.unreadCount > prevUnread && !isActiveConv) {
            playMessageSound();
            break; // only play once per poll cycle
          }
        }
      }
      // Update prev unread tracking
      const newMap = {};
      for (const conv of data) {
        const key = conv.type === 'dm' ? `dm-${conv.userId}` : `proj-${conv.projectId}`;
        newMap[key] = conv.unreadCount;
      }
      prevUnreadRef.current = newMap;

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
      if (selectedConv.type === 'dm') {
        const data = await DB.getDMs(selectedConv.id);
        // New response format: { messages, otherReadAt }
        if (data.messages) {
          setMessages(data.messages);
          setOtherReadAt(data.otherReadAt || null);
        } else {
          // Backwards compat with old array format
          setMessages(data);
          setOtherReadAt(null);
        }
        await DB.markDMRead(selectedConv.id);
      } else {
        const data = await DB.getProjectMessages(selectedConv.id);
        setMessages(data);
        setOtherReadAt(null);
        await DB.markProjectChatRead(selectedConv.id);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (selectedConv) {
      loadMessages();
      const interval = setInterval(loadMessages, 5000);
      return () => clearInterval(interval);
    } else {
      setMessages([]);
      setOtherReadAt(null);
    }
  }, [selectedConv?.type, selectedConv?.id]);

  // Load channel members for project conversations (for @mentions)
  useEffect(() => {
    if (selectedConv?.type === 'project') {
      DB.getProjectMembers(selectedConv.id).then(setChannelMembers).catch(() => {});
    } else {
      setChannelMembers([]);
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

  // Close react picker on outside click
  useEffect(() => {
    if (!showReactPickerForMsg && !showThreadReactPickerForMsg) return;
    const handleClick = (e) => {
      if (!e.target.closest('.msg-react-picker') && !e.target.closest('.msg-react-btn')) {
        setShowReactPickerForMsg(null);
        setShowThreadReactPickerForMsg(null);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showReactPickerForMsg, showThreadReactPickerForMsg]);

  // Load thread when threadParentId changes
  useEffect(() => {
    if (!threadParentId || !selectedConv) return;
    const loadThread = async () => {
      try {
        const data = selectedConv.type === 'dm'
          ? await DB.getDMThread(selectedConv.id, threadParentId)
          : await DB.getProjectThread(selectedConv.id, threadParentId);
        setThreadParent(data.parent);
        setThreadMessages(data.replies);
      } catch { /* ignore */ }
    };
    loadThread();
    const interval = setInterval(loadThread, 5000);
    return () => clearInterval(interval);
  }, [threadParentId, selectedConv?.id]);

  // Auto-scroll thread to bottom
  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [threadMessages]);

  // Close thread when conversation changes
  useEffect(() => {
    setThreadParentId(null);
    setThreadParent(null);
    setThreadMessages([]);
    setThreadBody('');
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
      setShowMentions(false);
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

  const handleReact = async (msgId, emoji) => {
    try {
      if (selectedConv.type === 'dm') {
        await DB.reactToDM(msgId, emoji);
      } else {
        await DB.reactToProjectMessage(selectedConv.id, msgId, emoji);
      }
      setShowReactPickerForMsg(null);
      setShowThreadReactPickerForMsg(null);
      await loadMessages();
    } catch { /* ignore */ }
  };

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('msg-highlight');
      setTimeout(() => el.classList.remove('msg-highlight'), 2000);
    }
  };

  const handleSelectConv = (conv) => {
    setShowReactPickerForMsg(null);
    setShowMentions(false);
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

  // @Mention input handling
  const handleInputChange = (e) => {
    const val = e.target.value;
    setBody(val);

    if (selectedConv?.type === 'project') {
      const cursor = e.target.selectionStart;
      const textUpToCursor = val.slice(0, cursor);
      const mentionMatch = textUpToCursor.match(/@(\w*)$/);
      if (mentionMatch) {
        setShowMentions(true);
        setMentionFilter(mentionMatch[1].toLowerCase());
      } else {
        setShowMentions(false);
      }
    }
  };

  const insertMention = (username) => {
    const cursor = inputRef.current?.selectionStart || body.length;
    const textUpToCursor = body.slice(0, cursor);
    const mentionMatch = textUpToCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const before = textUpToCursor.slice(0, mentionMatch.index);
      const after = body.slice(cursor);
      setBody(`${before}@${username} ${after}`);
    }
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const filteredMembers = (channelMembers || []).filter(
    (m) => m.username.toLowerCase().includes(mentionFilter) && m.userId !== user?.id
  );

  // Thread panel: send reply
  const handleThreadSend = async () => {
    if (!threadBody.trim() || threadSending || !selectedConv || !threadParentId) return;
    setThreadSending(true);
    try {
      const threadOnly = !alsoSendToChannel;
      if (selectedConv.type === 'dm') {
        await DB.sendDM(selectedConv.id, threadBody.trim(), threadParentId, threadOnly);
      } else {
        await DB.postProjectMessage(selectedConv.id, threadBody.trim(), threadParentId, threadOnly);
      }
      setThreadBody('');
      // Reload both thread and main feed
      const loadThread = async () => {
        try {
          const data = selectedConv.type === 'dm'
            ? await DB.getDMThread(selectedConv.id, threadParentId)
            : await DB.getProjectThread(selectedConv.id, threadParentId);
          setThreadParent(data.parent);
          setThreadMessages(data.replies);
        } catch { /* ignore */ }
      };
      await Promise.all([loadThread(), loadMessages()]);
    } finally {
      setThreadSending(false);
    }
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
              <button className="messages-back-btn" onClick={() => { setSelectedConv(null); }}>
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

            <div className="messages-thread-container">
              <div className="messages-thread">
                {messages.length === 0 && (
                  <div className="messages-thread-empty">{t('messages.noMessages')}</div>
                )}
                {messages.map((msg, idx) => {
                  const senderId = msg.senderId || msg.userId;
                  const isMine = senderId === user?.id;
                  const grouped = isGrouped(messages, idx);
                  const showDate = shouldShowDateSep(messages, idx);
                  const isSeen = isMine && selectedConv.type === 'dm' && otherReadAt && new Date(msg.createdAt) <= new Date(otherReadAt);

                  return (
                    <div key={msg.id} id={`msg-${msg.id}`}>
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
                          {msg.replyTo && (
                            <div className="msg-reply-preview" onClick={() => scrollToMessage(msg.replyTo.id)}>
                              <span className="msg-reply-author">{msg.replyTo.username}</span>
                              <span className="msg-reply-text">{msg.replyTo.body}</span>
                            </div>
                          )}
                          <div className={`msg-bubble${isMine ? ' mine' : ''}`}>
                            <span className="msg-text">{renderBody(msg.body, onUserClick)}</span>
                            <span className="msg-time">{formatTime(msg.createdAt)}</span>
                            {isMine && selectedConv.type === 'dm' && (
                              <span className={`msg-status${isSeen ? ' seen' : ''}`}>
                                {isSeen ? '\u2713\u2713' : '\u2713'}
                              </span>
                            )}
                            <button
                              className="msg-reply-btn"
                              onClick={() => { setThreadParentId(msg.id); }}
                              title={t('messages.reply')}
                            >
                              <IconReply size={11} />
                            </button>
                            <button
                              className="msg-react-btn"
                              onClick={(e) => { e.stopPropagation(); setShowReactPickerForMsg(showReactPickerForMsg === msg.id ? null : msg.id); }}
                              title={t('messages.react')}
                            >+</button>
                            {isMine && (
                              <button className="msg-delete" onClick={() => handleDelete(msg.id)} title={t('messages.deleteMessage')}>
                                &times;
                              </button>
                            )}
                            {showReactPickerForMsg === msg.id && (
                              <div className="react-picker msg-react-picker">
                                {REACTION_EMOJIS.map((e) => (
                                  <button key={e} className="react-picker-emoji" onClick={() => handleReact(msg.id, e)}>{e}</button>
                                ))}
                              </div>
                            )}
                          </div>
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className="msg-reactions">
                              {Object.entries(msg.reactions).map(([emoji, users]) => {
                                const isMineReaction = users.some(u => u.userId === user?.id);
                                return (
                                  <div key={emoji} className="reaction-chip-wrapper" style={{ position: 'relative' }}>
                                    <button
                                      className={`reaction-chip${isMineReaction ? ' mine' : ''}`}
                                      onClick={() => handleReact(msg.id, emoji)}
                                      onMouseEnter={() => setReactorsPopup({ msgId: msg.id, emoji, users })}
                                      onMouseLeave={() => setReactorsPopup(null)}
                                    >
                                      {emoji} {users.length}
                                    </button>
                                    {reactorsPopup?.msgId === msg.id && reactorsPopup?.emoji === emoji && (
                                      <div className="reactors-popup">
                                        <div className="reactors-popup-title">{emoji} Reacted by</div>
                                        {users.map(u => (
                                          <div key={u.userId} className="reactors-popup-user"
                                            onClick={() => onUserClick && onUserClick(u.username)}>
                                            @{u.username}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {msg.replyCount > 0 && (
                            <button className="msg-thread-badge" onClick={() => setThreadParentId(msg.id)}>
                              {msg.replyCount} {msg.replyCount === 1 ? t('messages.reply') : t('messages.replies')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* ── Thread panel ── */}
              {threadParentId && (
                <div className="thread-panel">
                  <div className="thread-panel-header">
                    <h3>{t('messages.thread')}</h3>
                    <button onClick={() => { setThreadParentId(null); setThreadParent(null); setThreadMessages([]); setThreadBody(''); }}>&times;</button>
                  </div>
                  <div className="thread-panel-messages">
                    {threadParent && (
                      <div className="thread-parent-msg">
                        <div className="thread-parent-meta">
                          <span className="msg-sender">{threadParent.username}</span>
                          <span className="msg-time">{formatTime(threadParent.createdAt)}</span>
                        </div>
                        <p className="msg-text">{renderBody(threadParent.body, onUserClick)}</p>
                      </div>
                    )}
                    <div className="thread-divider">
                      {threadMessages.length} {threadMessages.length === 1 ? t('messages.reply') : t('messages.replies')}
                    </div>
                    {threadMessages.map((msg) => {
                      const senderId = msg.senderId || msg.userId;
                      const isMine = senderId === user?.id;
                      return (
                        <div key={msg.id} className={`msg-row${isMine ? ' mine' : ''}`}>
                          {!isMine && (
                            <div className="msg-avatar" onClick={() => onUserClick?.(msg.username)} style={{ cursor: 'pointer' }}>
                              {resolveAvatarUrl(msg.avatarUrl)
                                ? <img src={resolveAvatarUrl(msg.avatarUrl)} alt="" className="msg-avatar-img" />
                                : <span className="msg-avatar-placeholder">{msg.username?.charAt(0).toUpperCase()}</span>
                              }
                            </div>
                          )}
                          <div className="msg-content">
                            {!isMine && (
                              <span className="msg-sender" onClick={() => onUserClick?.(msg.username)}>
                                {msg.username}
                              </span>
                            )}
                            <div className={`msg-bubble${isMine ? ' mine' : ''}`}>
                              <span className="msg-text">{renderBody(msg.body, onUserClick)}</span>
                              <span className="msg-time">{formatTime(msg.createdAt)}</span>
                              <button
                                className="msg-react-btn"
                                onClick={(e) => { e.stopPropagation(); setShowThreadReactPickerForMsg(showThreadReactPickerForMsg === msg.id ? null : msg.id); }}
                                title={t('messages.react')}
                              >+</button>
                              {showThreadReactPickerForMsg === msg.id && (
                                <div className="react-picker msg-react-picker">
                                  {REACTION_EMOJIS.map((e) => (
                                    <button key={e} className="react-picker-emoji" onClick={() => handleReact(msg.id, e)}>{e}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                              <div className="msg-reactions">
                                {Object.entries(msg.reactions).map(([emoji, users]) => {
                                  const isMineReaction = users.some(u => u.userId === user?.id);
                                  return (
                                    <button
                                      key={emoji}
                                      className={`reaction-chip${isMineReaction ? ' mine' : ''}`}
                                      onClick={() => handleReact(msg.id, emoji)}
                                    >
                                      {emoji} {users.length}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={threadEndRef} />
                  </div>
                  <div className="thread-compose">
                    <label className="thread-send-to-channel">
                      <input type="checkbox" checked={alsoSendToChannel} onChange={e => setAlsoSendToChannel(e.target.checked)} />
                      {t('messages.alsoSendToChannel')}
                    </label>
                    <div className="messages-compose">
                      <input
                        ref={threadInputRef}
                        className="form-input messages-input"
                        type="text"
                        placeholder={t('messages.typeReply')}
                        value={threadBody}
                        onChange={(e) => setThreadBody(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleThreadSend();
                          }
                        }}
                        maxLength={selectedConv?.type === 'dm' ? 2000 : 1000}
                      />
                      <button className="messages-send-btn" disabled={!threadBody.trim() || threadSending} onClick={handleThreadSend}>
                        <IconSend />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="messages-compose-wrap">
              {showMentions && filteredMembers.length > 0 && (
                <div className="mention-dropdown">
                  {filteredMembers.slice(0, 8).map((m) => (
                    <button key={m.userId} className="mention-option" onClick={() => insertMention(m.username)}>
                      @{m.username}
                    </button>
                  ))}
                </div>
              )}
              <div className="messages-compose">
                <input
                  ref={inputRef}
                  className="form-input messages-input"
                  type="text"
                  placeholder={selectedConv?.type === 'project' ? t('messages.typeMessageMention') : t('messages.typeMessage')}
                  value={body}
                  onChange={handleInputChange}
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
