import Foundation

/// Minimal shape from GET /projects — enough to power the Tasks screen's
/// project picker and project tag. Extended when the Projects tab is built.
struct Project: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let color: String
}
