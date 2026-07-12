import SwiftUI

/// Mirrors dashboard/src/components/TaskRow.jsx: checkbox, title, recurrence/
/// streak/completion badges, project tag, priority badge, due date.
struct TaskRowView: View {
    let task: TaskItem
    let project: Project?
    let currentUserId: String
    let onToggle: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void

    private var isOwnTask: Bool { task.userId == currentUserId }
    private var effectiveDate: String? { task.dueDate ?? task.scheduledDate }
    private var isScheduledOnly: Bool { task.dueDate == nil && task.scheduledDate != nil }
    private var isOverdue: Bool {
        guard let due = task.dueDate, !task.isDone else { return false }
        return TaskDateFormatting.isOverdue(due)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Button(action: onToggle) {
                Image(systemName: task.isDone ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(task.isDone ? .green : .secondary)
                    .font(.title3)
            }
            .buttonStyle(.plain)
            .padding(.top, 2)

            VStack(alignment: .leading, spacing: 6) {
                Text(task.title)
                    .strikethrough(task.isDone)
                    .foregroundStyle(task.isDone ? .secondary : .primary)

                HStack(spacing: 6) {
                    if task.isRecurring {
                        badge(recurrenceLabel, systemImage: task.recurrence == "repeatable" ? "repeat" : nil, tint: .blue)
                    }
                    if task.isRecurring && task.completionCount > 0 {
                        badge("\u{d7}\(task.completionCount)", tint: .secondary)
                    }
                    if task.isRecurring && task.currentStreak > 0 {
                        badge("\(task.currentStreak)", systemImage: "flame.fill", tint: streakColor)
                    }
                    if let project {
                        projectTag(project)
                    }
                    badge(task.priority.capitalized, tint: priorityColor)
                }

                if let effectiveDate {
                    Label(TaskDateFormatting.display(effectiveDate), systemImage: isScheduledOnly ? "calendar" : "clock")
                        .font(.caption)
                        .foregroundStyle(isOverdue ? .red : .secondary)
                }
            }

            Spacer()
        }
        .contentShape(Rectangle())
        .swipeActions(edge: .trailing) {
            if isOwnTask {
                Button(role: .destructive, action: onDelete) {
                    Label("Delete", systemImage: "trash")
                }
                Button(action: onEdit) {
                    Label("Edit", systemImage: "pencil")
                }
                .tint(.blue)
            }
        }
    }

    private var recurrenceLabel: String {
        switch task.recurrence {
        case "daily": "Daily"
        case "weekly": "Weekly"
        case "monthly": "Monthly"
        case "repeatable": "Repeatable"
        default: task.recurrence.capitalized
        }
    }

    private var streakColor: Color {
        if task.currentStreak >= 30 { return .yellow }
        if task.currentStreak >= 7 { return .orange }
        return .secondary
    }

    private var priorityColor: Color {
        switch task.priority {
        case "high": .red
        case "low": .green
        default: .orange
        }
    }

    private func projectTag(_ project: Project) -> some View {
        let color = Color(hex: project.color) ?? .accentColor
        return HStack(spacing: 4) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(project.name)
        }
        .font(.caption2)
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(color.opacity(0.15), in: Capsule())
        .foregroundStyle(color)
    }

    private func badge(_ text: String, systemImage: String? = nil, tint: Color) -> some View {
        HStack(spacing: 2) {
            if let systemImage {
                Image(systemName: systemImage)
            }
            Text(text)
        }
        .font(.caption2)
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(tint.opacity(0.15), in: Capsule())
        .foregroundStyle(tint)
    }
}

private extension Color {
    /// Projects store colors as hex strings (e.g. "#5b8def") from a web color picker.
    init?(hex: String) {
        var sanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        sanitized.removeAll { $0 == "#" }
        guard sanitized.count == 6, let value = UInt64(sanitized, radix: 16) else { return nil }
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
