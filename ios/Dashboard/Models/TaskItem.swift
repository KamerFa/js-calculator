import Foundation

/// Mirrors the shape returned by GET/POST /tasks (see dashboard/server/routes/tasks.js toJSON).
/// Named `TaskItem` rather than `Task` to avoid colliding with Swift's
/// concurrency `Task` type used throughout the app for async dispatch.
struct TaskItem: Codable, Identifiable, Equatable {
    let id: String
    var projectId: String?
    var title: String
    var description: String
    var status: String // "todo" | "in_progress" | "done" — server-defined, kept as raw string
    var priority: String // "low" | "medium" | "high"
    var dueDate: String? // "YYYY-MM-DD"
    var recurrence: String // "none" | "daily" | "weekly" | "monthly" | "repeatable"
    let completedAt: String?
    let completedBy: String?
    let screenshotUrl: String?
    var scheduledDate: String?
    var customFields: [AnyCodable]
    let createdAt: String
    let userId: String
    let createdBy: String?
    var taskType: String // "shared" | "per_member"
    let completionCount: Int
    let currentStreak: Int
    let bestStreak: Int
    var effort: String // "low" | "medium" | "high"
    let completionDates: [String]?

    var isDone: Bool { status == "done" }
    var isRecurring: Bool { recurrence != "none" }
}

/// Body for POST /tasks. The server rebuilds every editable column from
/// these fields on every save (no partial merge server-side), so an edit
/// must always carry the task's full current state, not just the changed
/// field — otherwise omitted fields (due date, recurrence, priority, custom
/// fields...) get reset to their defaults. `TaskPayload.editing(_:)` below
/// is the only supported way to build one from an existing task.
struct TaskPayload: Encodable {
    var id: String?
    var title: String
    var description: String
    var projectId: String?
    var status: String
    var priority: String
    var dueDate: String?
    var scheduledDate: String?
    var customFields: [AnyCodable]
    var recurrence: String
    var taskType: String
    var effort: String
    /// Required alongside `status: "done"` when toggling a recurring
    /// per-member task, so the server logs the right day's completion.
    var completionDate: String?

    static func new(title: String, description: String, projectId: String?, priority: String, dueDate: String?, recurrence: String, taskType: String, effort: String) -> TaskPayload {
        TaskPayload(
            id: nil, title: title, description: description, projectId: projectId,
            status: "todo", priority: priority, dueDate: dueDate, scheduledDate: nil,
            customFields: [], recurrence: recurrence, taskType: taskType, effort: effort,
            completionDate: nil
        )
    }

    static func editing(_ task: TaskItem, title: String? = nil, description: String? = nil, projectId: String?? = nil, status: String? = nil, priority: String? = nil, dueDate: String?? = nil, recurrence: String? = nil, taskType: String? = nil, effort: String? = nil, completionDate: String? = nil) -> TaskPayload {
        TaskPayload(
            id: task.id,
            title: title ?? task.title,
            description: description ?? task.description,
            projectId: projectId ?? task.projectId,
            status: status ?? task.status,
            priority: priority ?? task.priority,
            dueDate: dueDate ?? task.dueDate,
            scheduledDate: task.scheduledDate,
            customFields: task.customFields,
            recurrence: recurrence ?? task.recurrence,
            taskType: taskType ?? task.taskType,
            effort: effort ?? task.effort,
            completionDate: completionDate
        )
    }
}
