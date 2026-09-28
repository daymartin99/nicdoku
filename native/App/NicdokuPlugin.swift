import Foundation
import Capacitor
import HealthKit

/// JS name "Nicdoku" — see src/native/bridge.ts for the matching TypeScript side.
@objc(NicdokuPlugin)
public class NicdokuPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NicdokuPlugin"
    public let jsName = "Nicdoku"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestHealth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "powerStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "powerUpdate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "powerEnd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logMindful", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setStatus", returnType: CAPPluginReturnPromise),
    ]

    private let health = HealthBridge.shared
    private let link = WatchLink.shared

    override public func load() {
        link.onHeartRate = { [weak self] bpm, t in
            self?.notifyListeners("heartRate", data: ["bpm": bpm, "t": t])
        }
    }

    @objc func available(_ call: CAPPluginCall) {
        call.resolve(["health": HKHealthStore.isHealthDataAvailable(), "watch": link.hasWatchApp])
    }

    @objc func requestHealth(_ call: CAPPluginCall) {
        health.requestAuthorization { granted in call.resolve(["granted": granted]) }
    }

    @objc func powerStart(_ call: CAPPluginCall) {
        let startedAt = call.getDouble("startedAt") ?? Date().timeIntervalSince1970 * 1000
        let durationMs = call.getDouble("durationMs") ?? 3_600_000
        let spins: [Double] = (call.getArray("spins") ?? []).compactMap { NicdokuPlugin.number($0) }
        let stages: [[String: Any]] = (call.getArray("stages") ?? []).compactMap { value in
            guard let obj = value as? JSObject,
                  let name = obj["name"] as? String,
                  let at = NicdokuPlugin.number(obj["at"]) else { return nil }
            return ["name": name, "at": at]
        }
        link.startPower([
            "startedAt": startedAt,
            "durationMs": durationMs,
            "spins": spins,
            "stages": stages,
        ])
        // wakes the Watch app straight into its Power Hour screen (and heart-rate session)
        health.launchWatchApp { launched in call.resolve(["watchLaunched": launched]) }
    }

    @objc func powerUpdate(_ call: CAPPluginCall) {
        link.send([
            "type": "update",
            "combo": call.getInt("combo") ?? 0,
            "score": call.getInt("score") ?? 0,
            "stage": call.getString("stage") ?? "",
            "solved": call.getInt("solved") ?? 0,
        ])
        call.resolve()
    }

    @objc func powerEnd(_ call: CAPPluginCall) {
        link.endPower { samples in
            call.resolve(["samples": samples])
        }
    }

    @objc func logMindful(_ call: CAPPluginCall) {
        guard let start = call.getDouble("start"), let end = call.getDouble("end") else {
            call.resolve()
            return
        }
        health.saveMindful(start: Date(timeIntervalSince1970: start / 1000),
                           end: Date(timeIntervalSince1970: end / 1000)) { call.resolve() }
    }

    @objc func setStatus(_ call: CAPPluginCall) {
        var status: [String: Any] = [
            "state": call.getString("state") ?? "open",
            "streak": call.getInt("streak") ?? 0,
            "label": call.getString("label") ?? "",
        ]
        if let until = call.getDouble("until") { status["until"] = until }
        link.updateStatus(status)
        call.resolve()
    }

    /// JS numbers can arrive as Double, Int or NSNumber.
    static func number(_ value: JSValue?) -> Double? {
        if let d = value as? Double { return d }
        if let i = value as? Int { return Double(i) }
        if let n = value as? NSNumber { return n.doubleValue }
        return nil
    }
}
