# iOS App Conversion Plan (Native SwiftUI)

Convert the productivity dashboard into a native iOS app. Strategy: **full SwiftUI rewrite** of the frontend, reusing the existing Express/Postgres backend as-is. The web app stays; iOS becomes a second client of the same API.

## Architecture

- **New SwiftUI app** in an `ios/` folder alongside `dashboard/` and `calculator/`.
- **Target: iOS 17+** — unlocks the Observation framework (`@Observable`) for state management. Swift Charts (iOS 16+) covers the analytics graphs.
- **Backend unchanged**: the Express API (`dashboard/server/routes/*`) serves both clients. The two exceptions are new endpoints required by App Store review (account deletion, report/block — see Phases 1 and 2).
- **Auth**: same JWT Bearer flow as web (`dashboard/src/db.js` attaches `Authorization: Bearer <token>`), but the token lives in the **iOS Keychain** instead of `localStorage`. A small Swift `APIClient` mirrors `db.js`'s request layer.
- **Models**: hand-written `Codable` structs mirroring the JSON shapes returned by each route (the server already camelCases via its `toJSON` helpers).
- **Realtime**: the web app is 100% polling — no websockets or SSE anywhere. Messages poll every 5s, conversations 10s, project chat 15s, unread counts 30s. iOS replicates this with a **scene-aware polling engine**: timers run only while the scene is active, pause in background, and refresh immediately on foregrounding. Never poll in background (battery + App Review).
- **Cold starts**: `render.yaml` pins the backend to Render's free tier, which spins down when idle — first request after idle can hang 20–50s. The app needs a launch/loading state that tolerates this gracefully (retry with message, not a spinner that looks hung). Move to a paid tier before App Store release.

## Explicitly dropped

- **Landing page 3D hero** (`LandingView.jsx`, the only consumer of `three`/`@react-three/fiber`). Marketing-only; the iOS app opens straight into login.

## Phase 1 — Core loop (MVP)

Goal: a usable, App-Store-submittable daily-driver for the core productivity workflow.

1. **Auth**: login + register screens; JWT in Keychain; auto-login via `GET /auth/me`.
2. **Tasks**: list, create, edit, complete, filters (mirrors `TasksPage`/`TaskList`).
3. **Projects + Kanban**: project grid, project detail with kanban board and task management (`ProjectsPage`, `ProjectView`, `ProjectKanban`).
4. **Calendar**: month/agenda views of tasks and events (`CalendarPage`).
5. **Notes — read-only**: note bodies are stored as **BlockNote JSON strings** (see `NoteModal.jsx` — the editor state is `JSON.stringify`ed into `body`). Plain-text display would show raw JSON for every web-created note. Phase 1 ships a **read-only BlockNote-JSON → AttributedString renderer** (the block schema is documented; paragraphs/headings/lists cover most content). Editing is deferred to Phase 3.
6. **Account deletion** ⚠️ App Store requirement: the API has `POST /auth/register` but **no delete-account endpoint**. Apple Guideline 5.1.1(v) requires in-app account deletion when accounts can be created. New server endpoint + entry in the iOS settings screen. Hard blocker for review — must be in Phase 1.
7. **Cold-start-tolerant launch flow** (see Architecture).

## Phase 2 — Social & collaboration

Goal: messaging, community, and profiles at parity with web.

1. **Generic chat component + `ChatAPI` protocol.** DMs (`dm.js`), group chats (`groups.js`), and project chat (`messages.js`) are three parallel surfaces with an identical feature set: threads, emoji reactions, typing indicators, read receipts, and the same endpoint shape (`GET messages / POST message / POST react/:id / GET thread/:parentId / POST typing / PUT read`). Build **one** SwiftUI chat view driven by a `ChatAPI` protocol with three endpoint implementations — not three chat UIs. This is the biggest design decision in Phase 2; it replaces ~2,600 lines of web chat UI with one reusable component.
   - Typing indicators are `POST .../typing` heartbeats read back on the next poll — they work over polling as-is.
   - Messaging is **text-only** (no attachment routes exist); no upload work needed here.
2. **Scene-aware polling engine** (shared infrastructure, built here where it's needed most): per-screen cadences mirroring the web's 5/10/15/30s tiers.
3. **In-app notifications**: list + unread badge + per-type preferences, all backed by existing `notifications.js` endpoints. (Push/APNs stays in Phase 3.)
4. **Community**: browse/join/leave community projects (`community.js`).
5. **Users directory + Profile**: view/edit profile, friends, profile comments; avatar upload via `PhotosPicker` + multipart request (the only `multer` upload surface).
6. **Settings**: theme, language (web has `src/locales/`), notification preferences, account deletion entry point.
7. **Report + block system** ⚠️ App Store requirement: the app has UGC everywhere (DMs, group chats, community, profile comments, tweets feed) but **no report-content or block-user capability in the API**. Apple Guideline 1.2 requires both for UGC apps, plus published support contact info. New server endpoints (report message/comment/user, block/unblock user, filter blocked users from all feeds) + iOS UI (long-press report/block actions). Hard blocker for shipping any messaging/community feature.

**Deferred from Phase 2**: the `tweets.js` social feed. It's the least core social feature, and every UGC surface widens the moderation area Apple scrutinizes. Ship DMs + groups + community first; tweets move to Phase 3.

## Phase 3 — Rich features & native wins

1. **Notes editing**: TextKit/AttributedString-based editor writing BlockNote-compatible JSON, or a deliberately scoped-down formatting set (headings, bold/italic, lists) that round-trips with web.
2. **Push notifications (APNs)**: the main "why go native" win. New server work: device-token registration + APNs sends alongside the existing in-app notification writes; reuses the existing `notifications.js` preferences.
3. **Analytics charts**: recharts → Swift Charts port (`ProjectStatsGraph`, `ProjectProductivityStats`, `ProductivityDashboard`) — straightforward 1:1.
4. **Focus timer**: `FocusTimer` port with Live Activity on the lock screen (nice native win).
5. **News** (`news.js` feed) and **tweets feed** (deferred from Phase 2).
6. **Radio**: `radioAudio` station streaming → `AVPlayer` + background-audio entitlement + lock-screen Now Playing controls + sleep timer.
7. **Vaktija**: prayer times via local calculation + vaktija.ba API (`VaktijasPage`); candidate for a home-screen widget.

## App Store review checklist (hard requirements)

- [ ] Account deletion in-app (5.1.1(v)) — Phase 1
- [ ] UGC report + block + support contact (1.2) — Phase 2
- [ ] Privacy policy URL + App Privacy nutrition labels (data collected: account info, user content)
- [ ] Background audio entitlement only if Radio ships (Phase 3)
- [ ] Push entitlement + APNs key only in Phase 3

## Risks

| Risk | Mitigation |
| --- | --- |
| BlockNote JSON schema drift between web editor upgrades and iOS renderer | Pin `@blocknote/*` versions; add a fallback that renders unknown blocks as plain text |
| Render free-tier cold starts make the app feel broken | Tolerant launch flow now; paid tier before release |
| Rejection over UGC moderation | Build report/block in Phase 2 before submitting any messaging build |
| Two frontends drift (web vs iOS) | Backend owns all logic; keep clients thin; API changes reviewed against both clients |
