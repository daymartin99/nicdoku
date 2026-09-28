import Foundation
import WatchConnectivity

/// iPhone ↔ Watch messaging. Live messages when the Watch app is reachable, queued
/// transfers otherwise, and application context for the always-current status.
final class WatchLink: NSObject, WCSessionDelegate {
    static let shared = WatchLink()

    /// (bpm, epoch ms) as heart-rate readings stream in from the Watch
    var onHeartRate: ((Double, Double) -> Void)?

    private var series: [[String: Double]]?
    private var seriesWaiters: [([[String: Double]]) -> Void] = []

    var hasWatchApp: Bool {
        WCSession.isSupported() && WCSession.default.isPaired && WCSession.default.isWatchAppInstalled
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func send(_ message: [String: Any]) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated, session.isWatchAppInstalled else { return }
        if session.isReachable {
            session.sendMessage(message, replyHandler: nil) { _ in session.transferUserInfo(message) }
        } else {
            session.transferUserInfo(message)
        }
    }

    func startPower(_ payload: [String: Any]) {
        series = nil
        var message = payload
        message["type"] = "start"
        send(message)
    }

    /// Tell the Watch to stop; hand back its full heart-rate series (or [] after 4 s).
    func endPower(_ done: @escaping ([[String: Double]]) -> Void) {
        send(["type": "end"])
        if let series {
            done(series)
            return
        }
        seriesWaiters.append(done)
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            self?.flushWaiters([])
        }
    }

    func updateStatus(_ status: [String: Any]) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated, session.isWatchAppInstalled else { return }
        try? session.updateApplicationContext(["status": status])
    }

    private func flushWaiters(_ samples: [[String: Double]]) {
        let waiters = seriesWaiters
        seriesWaiters = []
        waiters.forEach { $0(samples) }
    }

    private func handle(_ message: [String: Any]) {
        DispatchQueue.main.async {
            if let bpm = (message["hr"] as? NSNumber)?.doubleValue,
               let t = (message["t"] as? NSNumber)?.doubleValue {
                self.onHeartRate?(bpm, t)
            }
            if let raw = message["series"] as? [[String: Any]] {
                let samples: [[String: Double]] = raw.compactMap { s in
                    guard let t = (s["t"] as? NSNumber)?.doubleValue,
                          let bpm = (s["bpm"] as? NSNumber)?.doubleValue else { return nil }
                    return ["t": t, "bpm": bpm]
                }
                self.series = samples
                self.flushWaiters(samples)
            }
        }
    }

    // MARK: WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) { handle(message) }
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) { handle(userInfo) }
}
