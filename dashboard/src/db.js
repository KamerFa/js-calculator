// ============================================================
// DATA LAYER — API client (replaces localStorage)
// All functions remain async, same interface as before.
// ============================================================

const BASE = '/api';

function getToken() {
  return localStorage.getItem('dash_token');
}

async function api(path, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });

  if (res.status === 401) {
    localStorage.removeItem('dash_token');
    window.location.reload();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

const STORE_MAP = {
  projects: '/projects',
  tasks: '/tasks',
  notes: '/notes',
};

const DB = {
  async getAll(store) {
    return api(STORE_MAP[store]);
  },

  async save(store, item) {
    return api(STORE_MAP[store], {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  async delete(store, id) {
    return api(`${STORE_MAP[store]}/${id}`, { method: 'DELETE' });
  },

  async deleteTasksByProject(projectId) {
    return api(`/tasks/by-project/${projectId}`, { method: 'DELETE' });
  },

  async clearNoteAttachment(type, id) {
    return api('/notes/clear-attachment', {
      method: 'POST',
      body: JSON.stringify({ type, id }),
    });
  },

  async getProjectMembers(projectId) {
    return api(`/projects/${projectId}/members`);
  },

  async addProjectMember(projectId, username) {
    return api(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  },

  async removeProjectMember(projectId, userId) {
    return api(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
  },

  async getProjectStats(projectId) {
    return api(`/projects/${projectId}/stats`);
  },

  // No-op — seeding is handled server-side on registration
  async seed() {},

  // ── Screenshot upload ──────────────────────────────────────
  async uploadScreenshot(taskId, file) {
    const token = getToken();
    const formData = new FormData();
    formData.append('screenshot', file);
    const res = await fetch(`${BASE}/tasks/${taskId}/screenshot`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Upload failed');
    }
    return res.json();
  },

  // ── Tweets ──────────────────────────────────────────────────
  async getTweets() {
    return api('/tweets');
  },

  async postTweet(body) {
    return api('/tweets', { method: 'POST', body: JSON.stringify({ body }) });
  },

  async deleteTweet(id) {
    return api(`/tweets/${id}`, { method: 'DELETE' });
  },

  async editTweet(id, body) {
    return api(`/tweets/${id}`, { method: 'PUT', body: JSON.stringify({ body }) });
  },

  async reactToTweet(tweetId, emoji) {
    return api(`/tweets/${tweetId}/react`, { method: 'POST', body: JSON.stringify({ emoji }) });
  },

  async commentOnTweet(tweetId, body) {
    return api(`/tweets/${tweetId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
  },

  async deleteComment(commentId) {
    return api(`/tweets/comments/${commentId}`, { method: 'DELETE' });
  },

  // ── Profile ─────────────────────────────────────────────────
  async getProfile() {
    return api('/profile/me');
  },

  async getPublicProfile(username) {
    return api(`/profile/user/${username}`);
  },

  async getUserProjects(username) {
    return api(`/profile/user/${username}/projects`);
  },

  async updateProfile(data) {
    return api('/profile/me', { method: 'PUT', body: JSON.stringify(data) });
  },

  async uploadAvatar(file) {
    const token = getToken();
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await fetch(`${BASE}/profile/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Upload failed');
    }
    return res.json();
  },

  // ── Community ───────────────────────────────────────────────
  async getCommunityProjects() {
    return api('/community/projects');
  },

  async joinCommunityProject(projectId) {
    return api(`/community/projects/${projectId}/join`, { method: 'POST' });
  },

  async leaveCommunityProject(projectId) {
    return api(`/community/projects/${projectId}/leave`, { method: 'POST' });
  },

  async importProject(data) {
    return api('/projects/import', { method: 'POST', body: JSON.stringify(data) });
  },

  // ── Users ─────────────────────────────────────────────────
  async getUsers() {
    return api('/users');
  },

  // ── Comment voting ────────────────────────────────────────
  async voteComment(commentId, vote) {
    return api(`/tweets/comments/${commentId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote }),
    });
  },

  // ── Project messages (chat) ──────────────────────────────
  async getProjectMessages(projectId, before) {
    const qs = before ? `?before=${encodeURIComponent(before)}` : '';
    return api(`/messages/${projectId}${qs}`);
  },

  async postProjectMessage(projectId, body, replyToId, threadOnly) {
    return api(`/messages/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ body, replyToId: replyToId || undefined, threadOnly: threadOnly || undefined }),
    });
  },

  async getProjectThread(projectId, parentId) {
    return api(`/messages/${projectId}/thread/${parentId}`);
  },

  async deleteProjectMessage(projectId, messageId) {
    return api(`/messages/${projectId}/${messageId}`, { method: 'DELETE' });
  },

  // ── Notifications ──────────────────────────────────────────
  async getNotifications() {
    return api('/notifications');
  },

  async getUnreadCount() {
    return api('/notifications/unread-count');
  },

  async markNotificationRead(id) {
    return api(`/notifications/${id}/read`, { method: 'PUT' });
  },

  async markAllNotificationsRead() {
    return api('/notifications/read-all', { method: 'PUT' });
  },

  // ── Task History ──────────────────────────────────────────
  async getTaskHistory(taskId) {
    return api(`/tasks/${taskId}/history`);
  },

  // ── Notification Management ─────────────────────────────
  async deleteNotification(id) {
    return api(`/notifications/${id}`, { method: 'DELETE' });
  },

  async getNotificationPreferences() {
    return api('/notifications/preferences');
  },

  async updateNotificationPreferences(prefs) {
    return api('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  },

  // ── Profile Comments ──────────────────────────────────────
  async getProfileComments(username) {
    return api(`/profile/user/${username}/comments`);
  },

  async postProfileComment(username, body) {
    return api(`/profile/user/${username}/comments`, {
      method: 'POST', body: JSON.stringify({ body }),
    });
  },

  async deleteProfileComment(id) {
    return api(`/profile/comments/${id}`, { method: 'DELETE' });
  },

  // ── Nicknames ────────────────────────────────────────────
  async setNickname(userId, nickname) {
    return api(`/profile/nickname/${userId}`, {
      method: 'PUT', body: JSON.stringify({ nickname }),
    });
  },

  async getNicknames() {
    return api('/profile/nicknames');
  },

  // ── Friends (Ahbab) ──────────────────────────────────────
  async sendFriendRequest(userId) {
    return api(`/profile/friend/${userId}`, { method: 'POST' });
  },

  async acceptFriendRequest(userId) {
    return api(`/profile/friend/${userId}/accept`, { method: 'PUT' });
  },

  async removeFriend(userId) {
    return api(`/profile/friend/${userId}`, { method: 'DELETE' });
  },

  async getFriends() {
    return api('/profile/friends');
  },

  // ── Item Comments (tasks, projects, notes) ────────────────
  async getComments(targetType, targetId) {
    return api(`/comments/${targetType}/${targetId}`);
  },

  async postComment(targetType, targetId, body) {
    return api(`/comments/${targetType}/${targetId}`, {
      method: 'POST', body: JSON.stringify({ body }),
    });
  },

  async deleteItemComment(commentId) {
    return api(`/comments/${commentId}`, { method: 'DELETE' });
  },

  // ── User Status ─────────────────────────────────────────────
  async updateStatus(data) {
    return api('/profile/status', { method: 'PUT', body: JSON.stringify(data) });
  },

  // ── Radio station reports ──────────────────────────────────
  async getStationReports() {
    return api('/radio/reports');
  },

  async reportStation(stationId) {
    return api(`/radio/report/${stationId}`, { method: 'POST' });
  },

  // ── Radio listening status ──────────────────────────────────
  async updateListening(stationId) {
    return api('/radio/listening', { method: 'PUT', body: JSON.stringify({ stationId }) });
  },

  async stopListening() {
    return api('/radio/listening', { method: 'DELETE' });
  },

  async getListeners() {
    return api('/radio/listeners');
  },

  // ── News ────────────────────────────────────────────────────
  async getNews(params = {}) {
    const qs = new URLSearchParams();
    if (params.source) qs.set('source', params.source);
    if (params.category) qs.set('category', params.category);
    const q = qs.toString();
    return api(`/news${q ? `?${q}` : ''}`);
  },

  async getNewsSources() {
    return api('/news/sources');
  },

  async getArticle(url) {
    return api(`/news/article?url=${encodeURIComponent(url)}`);
  },

  // ── Focus Timer ─────────────────────────────────────────────
  async startFocusSession(taskId, duration) {
    return api('/focus/start', {
      method: 'POST',
      body: JSON.stringify({ taskId, duration }),
    });
  },

  async completeFocusSession(id) {
    return api(`/focus/${id}/complete`, { method: 'POST' });
  },

  async cancelFocusSession(id) {
    return api(`/focus/${id}`, { method: 'DELETE' });
  },

  async getFocusToday() {
    return api('/focus/today');
  },

  async getFocusForTask(taskId) {
    return api(`/focus/task/${taskId}`);
  },

  async getFocusHistory() {
    return api('/focus/history');
  },

  // ── Direct Messages ────────────────────────────────────────
  async getConversations() {
    return api('/dm/conversations');
  },

  async getDMs(userId, before) {
    const qs = before ? `?before=${encodeURIComponent(before)}` : '';
    return api(`/dm/${userId}${qs}`);
  },

  async sendDM(userId, body, replyToId, threadOnly) {
    return api(`/dm/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ body, replyToId: replyToId || undefined, threadOnly: threadOnly || undefined }),
    });
  },

  async getDMThread(userId, parentId) {
    return api(`/dm/${userId}/thread/${parentId}`);
  },

  async deleteDM(messageId) {
    return api(`/dm/${messageId}`, { method: 'DELETE' });
  },

  async markDMRead(userId) {
    return api(`/dm/${userId}/read`, { method: 'PUT' });
  },

  async reactToDM(messageId, emoji) {
    return api(`/dm/react/${messageId}`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  },

  async reactToProjectMessage(projectId, messageId, emoji) {
    return api(`/messages/${projectId}/react/${messageId}`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  },

  async markProjectChatRead(projectId) {
    return api(`/messages/${projectId}/read`, { method: 'PUT' });
  },

  async getUnreadMessageCount() {
    return api('/dm/unread-total');
  },
};

// ── Auth helpers ──────────────────────────────────────────────
async function authRegister(username, password) {
  const data = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem('dash_token', data.token);
  return data;
}

async function authLogin(username, password) {
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem('dash_token', data.token);
  return data;
}

async function authMe() {
  return api('/auth/me');
}

function authLogout() {
  localStorage.removeItem('dash_token');
  window.location.reload();
}

function isLoggedIn() {
  return !!getToken();
}

export { DB, authRegister, authLogin, authMe, authLogout, isLoggedIn };
