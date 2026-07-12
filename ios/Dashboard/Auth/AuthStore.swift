import Foundation
import Observation

@Observable
final class AuthStore {
    enum State: Equatable {
        /// Checking the Keychain token against GET /auth/me on launch.
        case restoring
        case loggedOut
        case loggedIn(User)
    }

    private(set) var state: State = .restoring

    let api: APIClient

    init() {
        api = APIClient(tokenProvider: { KeychainStore.readToken() })
    }

    /// Called once at launch: validates any stored token against the server.
    /// A network failure (e.g. Render cold start timeout) keeps the user
    /// logged in optimistically only if we can't reach the server at all;
    /// an explicit 401 clears the session.
    func restoreSession() async {
        guard KeychainStore.readToken() != nil else {
            state = .loggedOut
            return
        }
        do {
            let me: MeResponse = try await api.get("/auth/me")
            state = .loggedIn(me.user)
        } catch APIError.unauthorized {
            KeychainStore.deleteToken()
            state = .loggedOut
        } catch {
            // Server unreachable — retry rather than dumping the user to login.
            state = .restoring
            try? await Task.sleep(for: .seconds(3))
            await restoreSession()
        }
    }

    func login(username: String, password: String) async throws {
        try await authenticate(path: "/auth/login", username: username, password: password)
    }

    func register(username: String, password: String) async throws {
        try await authenticate(path: "/auth/register", username: username, password: password)
    }

    func logout() {
        KeychainStore.deleteToken()
        state = .loggedOut
    }

    /// Central 401 handling for feature code: wrap API calls in this so an
    /// expired session drops back to the login screen, like the web client's
    /// reload-on-401.
    func handleUnauthorized(_ error: Error) {
        if case APIError.unauthorized = error {
            logout()
        }
    }

    private struct Credentials: Encodable {
        let username: String
        let password: String
    }

    private func authenticate(path: String, username: String, password: String) async throws {
        let response: AuthResponse = try await api.post(
            path,
            body: Credentials(username: username.trimmingCharacters(in: .whitespaces), password: password)
        )
        KeychainStore.saveToken(response.token)
        state = .loggedIn(response.user)
    }
}
