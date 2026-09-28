import Foundation
import WatchConnectivity

/// Watch ↔ iPhone messaging (the Watch side of WatchLink.swift).
final class PhoneLink: NSObject, WCSessionDelegate {
    static let shared = PhoneLink()

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    /// Live-only (heart-rate ticks): dropped if the phone isn't reachable right now.
    func sendLive(_ message: [String: Any]) {
        let session = WCSession.default
        guard session.activationState == .activated, session.isReachable else { return }
        session.sendMessage(message, replyHandler: nil, errorHandler: nil)
    }

    /// Must arrive (the final series): falls back to a queued transfer.
    func send(_ message: [String: Any]) {
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        if session.isReachable {
            session.sendMessage(message, replyHandler: nil) { _ in session.transferUserInfo(message) }
        } else {
            session.transferUserInfo(message)
        }
    }

    private func handle(_ message: [String: Any]) {
        switch message["type"] as? String {
        case "start":
            guard let startedAt = (message["startedAt"] as? NSNumber)?.doubleValue,
                  let durationMs = (message["durationMs"] as? NSNumber)?.doubleValue else { return }
            let spins = (message["spins"] as? [NSNumber] ?? []).map { $0.doubleValue / 1000 }
            let stages = (message["stages"] as? [[String: Any]] ?? []).compactMap { s -> PowerPlan.Stage? in
                guard let name = s["name"] as? String, let at = (s["at"] as? NSNumber)?.doubleValue else { return nil }
                return PowerPlan.Stage(name: name, at: at / 1000)
            }
            let plan = PowerPlan(startedAt: Date(timeIntervalSince1970: startedAt / 1000),
                                 duration: durationMs / 1000,
                                 spins: spins,
                                 stages: stages)
            DispatchQueue.main.async {
                WatchModel.shared.begin(plan)
                WorkoutManager.shared.start()
            }
        case "update":
            let combo = (message["combo"] as? NSNumber)?.intValue ?? 0
            let score = (message["score"] as? NSNumber)?.intValue ?? 0
            let solved = (message["solved"] as? NSNumber)?.intValue ?? 0
            DispatchQueue.main.async { WatchModel.shared.update(combo: combo, score: score, solved: solved) }
        case "end":
            DispatchQueue.main.async {
                WatchModel.shared.end()
                WorkoutManager.shared.stop()
            }
        default:
            break
        }
    }

    private func handleContext(_ context: [String: Any]) {
        guard let raw = context["status"] as? [String: Any] else { return }
        let status = NicdokuStatus(dictionary: raw)
        DispatchQueue.main.async { WatchModel.shared.setStatus(status) }
    }

    // MARK: WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if !session.receivedApplicationContext.isEmpty { handleContext(session.receivedApplicationContext) }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        handleContext(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) { handle(message) }
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) { handle(userInfo) }
}
