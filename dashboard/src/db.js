// ============================================================
// DATA LAYER — swap this section to connect a real backend
// All functions are async-ready (return Promises) even though
// localStorage is synchronous, so you can drop in fetch() calls
// without changing any calling code.
// ============================================================

function uid() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    ((Math.random() * 16) | 0).toString(16)
  );
}

const DB = {
  _get(store) {
    try {
      return JSON.parse(localStorage.getItem('dash_' + store)) || [];
    } catch {
      return [];
    }
  },

  _set(store, data) {
    localStorage.setItem('dash_' + store, JSON.stringify(data));
  },

  async getAll(store) {
    return this._get(store);
  },

  async save(store, item) {
    const items = this._get(store);
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      items[idx] = item;
    } else {
      items.push(item);
    }
    this._set(store, items);
    return item;
  },

  async delete(store, id) {
    const items = this._get(store).filter((i) => i.id !== id);
    this._set(store, items);
  },

  async seed() {
    if (this._get('projects').length > 0) return;

    const pid1 = uid(),
      pid2 = uid(),
      pid3 = uid();

    const projects = [
      {
        id: pid1,
        name: 'Website Redesign',
        description:
          'Overhaul the company marketing site with new branding.',
        color: '#2a5caa',
        createdAt: new Date().toISOString(),
      },
      {
        id: pid2,
        name: 'Mobile App',
        description:
          'Cross-platform mobile app for customer self-service.',
        color: '#c0392b',
        createdAt: new Date().toISOString(),
      },
      {
        id: pid3,
        name: 'API Platform',
        description:
          'Build public-facing REST API with documentation.',
        color: '#276749',
        createdAt: new Date().toISOString(),
      },
    ];

    const today = new Date();
    const d = (offset) => {
      const dt = new Date(today);
      dt.setDate(dt.getDate() + offset);
      return dt.toISOString().split('T')[0];
    };

    const tasks = [
      {
        id: uid(),
        title: 'Design homepage wireframes',
        description:
          'Create low-fi wireframes for the new homepage layout.',
        projectId: pid1,
        status: 'done',
        priority: 'high',
        dueDate: d(-3),
        customFields: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        title: 'Set up CI/CD pipeline',
        description: '',
        projectId: pid1,
        status: 'in-progress',
        priority: 'medium',
        dueDate: d(2),
        customFields: [{ key: 'Tool', value: 'GitHub Actions' }],
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        title: 'Write copy for About page',
        description: '',
        projectId: pid1,
        status: 'todo',
        priority: 'low',
        dueDate: d(7),
        customFields: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        title: 'User auth flow',
        description:
          'Implement login, signup, and password reset.',
        projectId: pid2,
        status: 'in-progress',
        priority: 'high',
        dueDate: d(1),
        customFields: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        title: 'Push notification setup',
        description: '',
        projectId: pid2,
        status: 'todo',
        priority: 'medium',
        dueDate: d(10),
        customFields: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        title: 'Design API schema',
        description:
          'Define endpoints, resources, and error conventions.',
        projectId: pid3,
        status: 'done',
        priority: 'high',
        dueDate: d(-5),
        customFields: [{ key: 'Spec', value: 'OpenAPI 3.1' }],
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        title: 'Rate limiting middleware',
        description: '',
        projectId: pid3,
        status: 'todo',
        priority: 'medium',
        dueDate: d(4),
        customFields: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        title: 'Weekly team sync notes',
        description:
          'Summarize action items from Friday meeting.',
        projectId: null,
        status: 'todo',
        priority: 'low',
        dueDate: d(0),
        customFields: [],
        createdAt: new Date().toISOString(),
      },
    ];

    const notes = [
      {
        id: uid(),
        title: 'Meeting Notes — Kickoff',
        body: 'Discussed project scope, timeline, and key milestones. Agreed on two-week sprint cycles. Design team will deliver first mockups by end of week.',
        attachedTo: { type: 'project', id: pid1 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: uid(),
        title: 'API Design Decisions',
        body: 'Use snake_case for all JSON fields. Pagination via cursor-based tokens. Rate limit: 1000 req/min per API key. Auth via Bearer tokens.',
        attachedTo: { type: 'project', id: pid3 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: uid(),
        title: 'Personal Reading List',
        body: 'Books to read:\n- Designing Data-Intensive Applications\n- The Pragmatic Programmer\n- Clean Architecture\n- Refactoring by Martin Fowler',
        attachedTo: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    this._set('projects', projects);
    this._set('tasks', tasks);
    this._set('notes', notes);
  },
};

export { DB, uid };
