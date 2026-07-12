import Foundation

enum APIError: LocalizedError {
    /// 401 — token missing/expired. AuthStore reacts by logging out,
    /// mirroring the web client's behavior in dashboard/src/db.js.
    case unauthorized
    /// Non-2xx with the server's `{ "error": "..." }` message when present.
    case server(status: Int, message: String)
    case network(URLError)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Session expired. Please log in again."
        case .server(_, let message):
            return message
        case .network(let error):
            if error.code == .timedOut {
                return "The server is taking a while to wake up. Please try again."
            }
            return error.localizedDescription
        case .decoding:
            return "Unexpected response from the server."
        }
    }
}

/// Thin async wrapper around the dashboard REST API. Mirrors the request
/// layer in dashboard/src/db.js: JSON in/out, Bearer token, `{error}` bodies.
struct APIClient {
    var baseURL: URL = AppConfig.apiBaseURL
    var tokenProvider: () -> String?

    private struct ErrorBody: Decodable { let error: String? }
    /// Sentinel for bodyless requests — `send`'s generic constraint requires
    /// `B: Encodable`, which `Never` does not satisfy, so GET/DELETE pass
    /// this instead of a real optional-body type.
    private struct NoBody: Encodable {}

    func get<T: Decodable>(_ path: String) async throws -> T {
        try await send(path: path, method: "GET", body: Optional<NoBody>.none)
    }

    func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        try await send(path: path, method: "POST", body: body)
    }

    func put<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        try await send(path: path, method: "PUT", body: body)
    }

    func delete<T: Decodable>(_ path: String) async throws -> T {
        try await send(path: path, method: "DELETE", body: Optional<NoBody>.none)
    }

    private func send<T: Decodable, B: Encodable>(path: String, method: String, body: B?) async throws -> T {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.timeoutInterval = AppConfig.requestTimeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = tokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch let error as URLError {
            throw APIError.network(error)
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { throw APIError.unauthorized }
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
            throw APIError.server(status: status, message: message ?? "API error \(status)")
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}
