import Foundation
import WidgetKit

/// Local widget snapshot. This is NOT yet connected to Supabase or the web app.
struct ClockSnapshot: Codable {
    var kind: String
    var project: String
    var startedAt: Date?
    var updatedAt: Date

    static let idle = ClockSnapshot(kind: "idle", project: "", startedAt: nil, updatedAt: .now)
    var isRunning: Bool { (kind == "work" || kind == "travel") && startedAt != nil }
}

enum ClockStore {
    static let group = "group.de.zeitwerk.native"
    private static let key = "zeitwerk.clock.v1"

    static func read() -> ClockSnapshot {
        guard let defaults = UserDefaults(suiteName: group),
              let data = defaults.data(forKey: key),
              let snapshot = try? JSONDecoder().decode(ClockSnapshot.self, from: data)
        else { return .idle }
        return snapshot
    }

    static func write(_ snapshot: ClockSnapshot) {
        guard let defaults = UserDefaults(suiteName: group),
              let data = try? JSONEncoder().encode(snapshot) else { return }
        defaults.set(data, forKey: key)
        WidgetCenter.shared.reloadTimelines(ofKind: "ZeitwerkClock")
    }
}
