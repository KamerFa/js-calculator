import Foundation

/// Server dates for tasks are plain "YYYY-MM-DD" strings (no time component),
/// matching dashboard/src/utils/time.js's formatDate.
enum TaskDateFormatting {
    private static let inputFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter
    }()

    private static let displayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter
    }()

    static func display(_ isoDate: String) -> String {
        guard let date = inputFormatter.date(from: isoDate) else { return isoDate }
        return displayFormatter.string(from: date)
    }

    static func isOverdue(_ isoDate: String) -> Bool {
        guard let date = inputFormatter.date(from: isoDate) else { return false }
        return date < Calendar.current.startOfDay(for: Date())
    }
}
