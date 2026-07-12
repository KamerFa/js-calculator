import Foundation
import Observation

@Observable
final class TaskStore {
    private(set) var tasks: [TaskItem] = []
    private(set) var projects: [Project] = []
    private(set) var isLoading = false
    var errorMessage: String?

    private let api: APIClient
    private let auth: AuthStore

    init(auth: AuthStore) {
        self.auth = auth
        self.api = auth.api
    }

    func loadAll() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let tasksResult: [TaskItem] = api.get("/tasks")
            async let projectsResult: [Project] = api.get("/projects")
            tasks = try await tasksResult
            projects = try await projectsResult
            errorMessage = nil
        } catch {
            auth.handleUnauthorized(error)
            errorMessage = error.localizedDescription
        }
    }

    func project(for task: TaskItem) -> Project? {
        guard let projectId = task.projectId else { return nil }
        return projects.first { $0.id == projectId }
    }

    /// Flips a task's completion state. Always sends the task's full current
    /// fields (via `TaskPayload.editing`) — see the comment on `TaskPayload`
    /// for why a partial update would silently wipe other fields server-side.
    func toggle(_ task: TaskItem) async {
        let newStatus = task.isDone ? "todo" : "done"
        let isRecurringPerMember = task.taskType == "per_member" && task.isRecurring
        let payload = TaskPayload.editing(
            task,
            status: newStatus,
            completionDate: isRecurringPerMember ? Self.todayString() : nil
        )
        await save(payload, replacing: task.id)
    }

    func createTask(title: String, description: String, projectId: String?, priority: String, dueDate: String?, recurrence: String, taskType: String, effort: String) async {
        let payload = TaskPayload.new(
            title: title, description: description, projectId: projectId,
            priority: priority, dueDate: dueDate, recurrence: recurrence,
            taskType: taskType, effort: effort
        )
        await save(payload, replacing: nil)
    }

    func update(_ task: TaskItem, title: String, description: String, projectId: String?, priority: String, dueDate: String?, recurrence: String, taskType: String, effort: String) async {
        let payload = TaskPayload.editing(
            task, title: title, description: description, projectId: projectId,
            priority: priority, dueDate: dueDate, recurrence: recurrence,
            taskType: taskType, effort: effort
        )
        await save(payload, replacing: task.id)
    }

    func delete(_ task: TaskItem) async {
        let previous = tasks
        tasks.removeAll { $0.id == task.id }
        do {
            let _: EmptyResponse = try await api.delete("/tasks/\(task.id)")
        } catch {
            tasks = previous
            auth.handleUnauthorized(error)
            errorMessage = error.localizedDescription
        }
    }

    private func save(_ payload: TaskPayload, replacing existingId: String?) async {
        do {
            let saved: TaskItem = try await api.post("/tasks", body: payload)
            if let index = tasks.firstIndex(where: { $0.id == (existingId ?? saved.id) }) {
                tasks[index] = saved
            } else {
                tasks.insert(saved, at: 0)
            }
            errorMessage = nil
        } catch {
            auth.handleUnauthorized(error)
            errorMessage = error.localizedDescription
        }
    }

    private static func todayString() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = .current
        return formatter.string(from: Date())
    }
}

struct EmptyResponse: Decodable {}
