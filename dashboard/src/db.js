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

  // No-op — seeding is handled server-side on registration
  async seed() {},
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
