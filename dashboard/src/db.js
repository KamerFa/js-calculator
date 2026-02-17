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
