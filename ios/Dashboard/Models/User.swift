import Foundation

struct User: Codable, Identifiable, Equatable {
    let id: String
    let username: String
    let avatarUrl: String?
}

/// Response of POST /auth/login and POST /auth/register.
struct AuthResponse: Decodable {
    let token: String
    let user: User
}

/// Response of GET /auth/me.
struct MeResponse: Decodable {
    let user: User
}
