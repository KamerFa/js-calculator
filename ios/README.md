# Dashboard iOS App

Native SwiftUI client for the productivity dashboard. The backend is the
existing Express/Postgres API in `../dashboard/server` — this app is a second
client of the same API. See `../dashboard/.claude/plan-ios-app.md` for the
full conversion plan.

## Requirements

- macOS with Xcode 15+
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)

The `.xcodeproj` is generated, not committed. From this directory:

```sh
xcodegen generate
open Dashboard.xcodeproj
```

## Running against a local backend

Debug builds point at `http://localhost:3001/api` (see
`Dashboard/Config/AppConfig.swift`). Start the backend first:

```sh
cd ../dashboard
npm install
npm run server   # listens on :3001, needs DATABASE_URL + JWT_SECRET
```

Then run the app in the iOS Simulator — the simulator shares the Mac's
localhost.

Release builds point at the Render deployment. The URL in `AppConfig.swift`
is a placeholder guess from `render.yaml`'s service name — confirm it before
shipping a release build.

## Current status (Phase 1 scaffold)

- [x] Xcode project scaffold (XcodeGen)
- [x] `APIClient` — async JSON client mirroring `dashboard/src/db.js` (Bearer
      token, `{error}` bodies, cold-start-tolerant timeout)
- [x] Keychain token storage
- [x] `AuthStore` (@Observable) — login, register, session restore, logout
- [x] Login/registration screen
- [x] Tab shell with placeholders for Tasks / Projects / Calendar / Notes
- [ ] Tasks
- [ ] Projects + Kanban
- [ ] Calendar
- [ ] Notes (read-only BlockNote renderer)
- [ ] Account deletion (needs new server endpoint — App Store 5.1.1(v))
