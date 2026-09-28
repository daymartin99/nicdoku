import Foundation
import WatchKit
import WidgetKit

/// Power Hour as the Watch sees it: its own copy of the schedule (so haptics land on time
/// even if a message from the phone is late), live combo/score, heart rate and status.
struct PowerPlan: Equatable {
    let startedAt: Date
    let duration: TimeInterval
    /// seconds from start
    let spins: [TimeInterval]
    let stages: [Stage]
    var endsAt: Date { startedAt.addingTimeInterval(duration) }

    struct Stage: Equatable {
        let name: String
        let at: TimeInterval
    }

    func stage(at date: Date) -> Stage? {
        let t = date.timeIntervalSince(startedAt)
        return stages.last(where: { $0.at <= t }) ?? stages.first
    }

    /// 0…1 through the hour
    func progress(at date: Date) -> Double {
        min(1, max(0, date.timeIntervalSince(startedAt) / duration))
    }
}

final class WatchModel: ObservableObject {
    static let shared = WatchModel()

    @Published var status: NicdokuStatus = StatusStore.load()
    @Published var plan: PowerPlan?
    @Published var combo = 0
    @Published var score = 0
    @Published var solved = 0
    @Published var heartRate: Double?
    /// "playing" → "time" (TIME.) → "breathe" → "done"
    @Published var phase = "idle"

    private var scheduled: [DispatchWorkItem] = []

    // MARK: Power Hour

    func begin(_ plan: PowerPlan) {
        guard self.plan != plan else { return }
        self.plan = plan
        combo = 0
        score = 0
        solved = 0
        phase = Date() < plan.endsAt ? "playing" : "done"
        scheduleHaptics(for: plan)
    }

    func update(combo: Int, score: Int, solved: Int) {
        if combo > self.combo, combo >= 2 { WKInterfaceDevice.current().play(.click) }
        self.combo = combo
        self.score = score
        self.solved = solved
    }

    /// The phone says the hour is over (on time or ended early).
    func end() {
        cancelHaptics()
        guard phase == "playing" else { return }
        showTime()
    }

    func reset() {
        cancelHaptics()
        plan = nil
        phase = "idle"
        heartRate = nil
    }

    private func showTime() {
        phase = "time"
        let device = WKInterfaceDevice.current()
        device.play(.success)
        after(0.35) { device.play(.success) }
        after(0.7) { device.play(.notification) }
        after(2.6) { [weak self] in self?.phase = "breathe" }
        // gentle taps to pace the breathing: in for 4 s, out for 6 s, three times
        for i in 0..<3 {
            after(2.6 + Double(i) * 10) { device.play(.start) }
            after(2.6 + Double(i) * 10 + 4) { device.play(.stop) }
        }
        after(33) { [weak self] in self?.phase = "done" }
    }

    // MARK: Haptics on the Watch's own clock

    private func scheduleHaptics(for plan: PowerPlan) {
        cancelHaptics()
        let device = WKInterfaceDevice.current()
        let now = Date()
        func at(_ offset: TimeInterval, _ block: @escaping () -> Void) {
            let delay = plan.startedAt.addingTimeInterval(offset).timeIntervalSince(now)
            if delay > 0 { after(delay, block) }
        }
        for spin in plan.spins {
            at(spin - 2) { device.play(.directionUp) } // "get ready"
            at(spin) { device.play(.retry) } // the turn
        }
        for stage in plan.stages where stage.at > 0 {
            at(stage.at) { device.play(.notification) }
        }
        at(plan.duration) { [weak self] in
            if self?.phase == "playing" { self?.showTime() }
        }
    }

    private func after(_ seconds: TimeInterval, _ block: @escaping () -> Void) {
        let item = DispatchWorkItem(block: block)
        scheduled.append(item)
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: item)
    }

    private func cancelHaptics() {
        scheduled.forEach { $0.cancel() }
        scheduled = []
    }

    // MARK: Status (complication + idle screen)

    func setStatus(_ status: NicdokuStatus) {
        self.status = status
        StatusStore.save(status)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
