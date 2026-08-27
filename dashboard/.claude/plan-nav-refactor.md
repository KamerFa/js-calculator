# Navigation Refactor + Performance & Robustness Overhaul

## Part 1: Navigation Bugs & Redesign

### Current Problems
1. **Projects in BottomTabBar opens sidebar** — On mobile, tapping "Projects" in the More sheet calls `onOpenSidebar()` which slides in the full desktop sidebar. User then has to scroll and pick a project. This is a 3-tap detour (More → Projects → pick project) and it feels broken because the sidebar is a desktop paradigm being shoehorned into mobile.
2. **No dedicated Projects page** — Desktop has projects always visible in sidebar. Mobile has no equivalent. Need a `/projects` route that shows all projects in a mobile-friendly grid/list.
3. **Bottom sheet is an extra tap for common destinations** — Messages, Users, Radio, Projects are all behind "More". Messages especially should be more accessible.
4. **Sidebar scroll lock is fragile** — `document.body.style.overflow = 'hidden'` can leak if component unmounts while open.

### Plan

#### A. Create a `/projects` page
- New `ProjectsPage.jsx` — a simple grid of project cards (color dot, name, task count, progress bar, members badge)
- Clicking a card navigates to `/project/:id`
- Add route to `App.jsx`
- This gives mobile users a proper landing page for browsing projects

#### B. Rework BottomTabBar
- Replace the current 4-tab + More layout with 5 direct tabs:
  - **Tasks** `/`
  - **Projects** `/projects` (new page, direct nav — no more sidebar opening)
  - **Calendar** `/calendar`
  - **Messages** `/messages`
  - **More** (bottom sheet with: Notes, Community, Users, News, Radio, Profile, Settings)
- This promotes the two most-used "hidden" items (Projects, Messages) to primary tabs
- Community drops to the More sheet (less frequent)

#### C. Fix sidebar mobile behavior
- Sidebar remains for desktop only as the persistent nav
- On mobile, sidebar is only opened for the user-menu / project filtering (or remove it entirely from mobile — the new Projects page replaces it)
- Remove the `onOpenSidebar` pattern from BottomTabBar entirely
- Clean up the scroll-lock to use a ref-based cleanup pattern

#### D. Add Projects route to sidebar (desktop)
- Add a "All Projects" link in the sidebar's project section header that navigates to `/projects`
- This gives desktop users a full-page projects view too

---

## Part 2: Performance & Robustness Refactor

### Critical (do first)

#### 1. Memoize Context values
- **DataContext.jsx**: Wrap the provider value in `useMemo` — currently creates a new object every render, causing ALL consumers to re-render
- **AuthContext.jsx**: Same — memoize the value object
- **ModalContext.jsx**: Same — memoize the value object

#### 2. Add Error Boundary
- Create a generic `ErrorBoundary` component
- Wrap `<Routes>` in App.jsx with it
- Wrap lazy-loaded routes with individual boundaries so one page crashing doesn't take down the app

#### 3. Guard async state updates
- Add cleanup flags (AbortController or `isMounted` ref) to:
  - `ProjectView` member fetch
  - `ProjectStatsGraph` data fetch
  - `ProjectProductivityStats` data fetch
  - `ProjectChat` message polling
  - `NewsView` article fetch
  - `NotificationBell` notification fetch

### High Priority

#### 4. Memoize expensive computations
- `TaskList.jsx`: Wrap filtered/grouped task arrays in `useMemo`
- `ProjectView.jsx`: Wrap `projectTasks`, `groups`, `projectNotes` in `useMemo`
- `Sidebar.jsx`: Memoize the `openCount` helper with `useCallback`

#### 5. Fix interval/polling leaks
- `ProjectChat`: Memoize `loadMessages` with `useCallback` so the interval doesn't recreate
- `NewsView`: Same for `fetchNews`
- `Sidebar` unread polling: Memoize `load` function
- `NotificationBell`: Memoize `loadUnread`

#### 6. Reduce DataContext over-fetching
- After `saveTask` / `toggleTask`: use the returned data to update locally instead of re-fetching entire task list
- After `saveProject`: same pattern — local update + background revalidation
- Split `reload()` so you can reload just tasks, just projects, or just notes independently

### Medium Priority

#### 7. Memo-wrap presentational components
- `ProjectStatsGraph` — receives only `projectId`, should be `memo()`
- `ProjectProductivityStats` — same
- `ProjectCompletionSummary` — same

#### 8. Clean up inline objects/functions in JSX
- Extract frequently-used inline styles to CSS classes or module-level constants
- Move inline arrow functions to component-level handlers where they cause child re-renders

---

## Implementation Order

1. **Create ProjectsPage + route** (unblocks nav fix)
2. **Rework BottomTabBar** (fix the core mobile bug)
3. **Memoize context values** (biggest perf win, 3 files)
4. **Add ErrorBoundary** (robustness)
5. **Fix async cleanup + interval leaks** (memory leaks)
6. **Memoize computations + components** (perf polish)
7. **Reduce DataContext over-fetching** (network perf)
8. **Build, test, commit**
