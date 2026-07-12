import SwiftUI

/// Create/edit form for a task. Fields cover what dashboard/src/components/
/// TaskModal.jsx exposes for everyday use (custom fields and screenshots are
/// left as web-only for now — this app round-trips them untouched via
/// TaskPayload.editing rather than rendering/editing them).
struct TaskFormView: View {
    let store: TaskStore
    let task: TaskItem?

    @Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var description: String
    @State private var projectId: String?
    @State private var priority: String
    @State private var hasDueDate: Bool
    @State private var dueDate: Date
    @State private var recurrence: String
    @State private var taskType: String
    @State private var effort: String
    @State private var isSaving = false

    private static let priorities = [("low", "Low"), ("medium", "Medium"), ("high", "High")]
    private static let recurrences = [("none", "None"), ("daily", "Daily"), ("weekly", "Weekly"), ("monthly", "Monthly"), ("repeatable", "Repeatable")]
    private static let taskTypes = [("shared", "Shared"), ("per_member", "Per Member")]
    private static let efforts = [("low", "Low"), ("medium", "Medium"), ("high", "High")]

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter
    }()

    init(store: TaskStore, task: TaskItem?) {
        self.store = store
        self.task = task
        _title = State(initialValue: task?.title ?? "")
        _description = State(initialValue: task?.description ?? "")
        _projectId = State(initialValue: task?.projectId)
        _priority = State(initialValue: task?.priority ?? "medium")
        _hasDueDate = State(initialValue: task?.dueDate != nil)
        _dueDate = State(initialValue: task?.dueDate.flatMap(Self.dateFormatter.date) ?? Date())
        _recurrence = State(initialValue: task?.recurrence ?? "none")
        _taskType = State(initialValue: task?.taskType ?? "shared")
        _effort = State(initialValue: task?.effort ?? "medium")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Title", text: $title)
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }

                Section("Project") {
                    Picker("Project", selection: $projectId) {
                        Text("None").tag(String?.none)
                        ForEach(store.projects) { project in
                            Text(project.name).tag(String?.some(project.id))
                        }
                    }
                }

                Section("Details") {
                    Picker("Priority", selection: $priority) {
                        ForEach(Self.priorities, id: \.0) { Text($0.1).tag($0.0) }
                    }
                    Picker("Effort", selection: $effort) {
                        ForEach(Self.efforts, id: \.0) { Text($0.1).tag($0.0) }
                    }
                    Picker("Type", selection: $taskType) {
                        ForEach(Self.taskTypes, id: \.0) { Text($0.1).tag($0.0) }
                    }
                }

                Section("Schedule") {
                    Toggle("Due date", isOn: $hasDueDate.animation())
                    if hasDueDate {
                        DatePicker("Due", selection: $dueDate, displayedComponents: .date)
                    }
                    Picker("Repeats", selection: $recurrence) {
                        ForEach(Self.recurrences, id: \.0) { Text($0.1).tag($0.0) }
                    }
                }
            }
            .navigationTitle(task == nil ? "New Task" : "Edit Task")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving…" : "Save") { save() }
                        .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
    }

    private func save() {
        isSaving = true
        let dueDateString = hasDueDate ? Self.dateFormatter.string(from: dueDate) : nil
        Task {
            defer { isSaving = false }
            if let task {
                await store.update(
                    task, title: title, description: description, projectId: projectId,
                    priority: priority, dueDate: dueDateString, recurrence: recurrence,
                    taskType: taskType, effort: effort
                )
            } else {
                await store.createTask(
                    title: title, description: description, projectId: projectId,
                    priority: priority, dueDate: dueDateString, recurrence: recurrence,
                    taskType: taskType, effort: effort
                )
            }
            dismiss()
        }
    }
}
