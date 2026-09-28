import Foundation

/// What the phone says about breaks right now. Shared by the Watch app and its complication
/// through an App Group, so the watch face stays correct even when the app isn't running.
struct NicdokuStatus: Codable, Equatable {
    /// "open" | "cooling" | "resting" | "power"
    var state: String
    /// epoch ms when a break opens again (cooling only)
    var until: Double?
    /// days played in the last 7
    var streak: Int
    var label: String

    static let fallback = NicdokuStatus(state: "open", until: nil, streak: 0, label: "Break open")

    var untilDate: Date? { until.map { Date(timeIntervalSince1970: $0 / 1000) } }

    /// A cooldown that has already run out reads as "open".
    func current(at now: Date = Date()) -> NicdokuStatus {
        if state == "cooling", let d = untilDate, d <= now {
            return NicdokuStatus(state: "open", until: nil, streak: streak, label: "Break open")
        }
        return self
    }

    init(state: String, until: Double?, streak: Int, label: String) {
        self.state = state
        self.until = until
        self.streak = streak
        self.label = label
    }

    init(dictionary d: [String: Any]) {
        state = d["state"] as? String ?? "open"
        until = (d["until"] as? NSNumber)?.doubleValue
        streak = (d["streak"] as? NSNumber)?.intValue ?? 0
        label = d["label"] as? String ?? "Break open"
    }
}

enum StatusStore {
    private static let key = "nicdoku.status"

    private static var defaults: UserDefaults? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "NicdokuAppGroup") as? String, !group.isEmpty else {
            return nil
        }
        return UserDefaults(suiteName: group)
    }

    static func save(_ status: NicdokuStatus) {
        guard let data = try? JSONEncoder().encode(status) else { return }
        defaults?.set(data, forKey: key)
    }

    static func load() -> NicdokuStatus {
        guard let data = defaults?.data(forKey: key),
              let status = try? JSONDecoder().decode(NicdokuStatus.self, from: data) else {
            return .fallback
        }
        return status
    }
}
