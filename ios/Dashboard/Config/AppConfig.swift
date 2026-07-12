import Foundation

enum AppConfig {
    /// Base URL of the dashboard API, including the /api prefix.
    /// Debug builds hit the local dev server (`npm run server` in dashboard/,
    /// which listens on port 3001). Release builds hit the Render deployment.
    static var apiBaseURL: URL {
        #if DEBUG
        URL(string: "http://localhost:3001/api")!
        #else
        // TODO: confirm the production URL of the Render service
        // (render.yaml names it "productivity-dashboard").
        URL(string: "https://productivity-dashboard.onrender.com/api")!
        #endif
    }

    /// Render's free tier spins the server down when idle; the first request
    /// after idle can take 20–50s while it cold-starts. Requests use a timeout
    /// long enough to survive that instead of failing at the default 60s TLS
    /// handshake limit.
    static let requestTimeout: TimeInterval = 75
}
