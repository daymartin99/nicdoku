import Foundation
import HealthKit

/// Runs a "mind and body" session during Power Hour purely to read live heart rate.
/// The workout itself is discarded at the end: puzzles aren't exercise, so nothing
/// is added to her Activity rings.
final class WorkoutManager: NSObject, HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate {
    static let shared = WorkoutManager()

    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var samples: [[String: Double]] = []

    private var heartRateType: HKQuantityType? { HKQuantityType.quantityType(forIdentifier: .heartRate) }

    var isRunning: Bool { session != nil }

    func start() {
        guard session == nil, HKHealthStore.isHealthDataAvailable(), let heartRateType else { return }
        let share: Set<HKSampleType> = [HKObjectType.workoutType()]
        let read: Set<HKObjectType> = [heartRateType]
        store.requestAuthorization(toShare: share, read: read) { [weak self] _, _ in
            DispatchQueue.main.async { self?.begin() }
        }
    }

    private func begin() {
        guard session == nil else { return }
        let config = HKWorkoutConfiguration()
        config.activityType = .mindAndBody
        config.locationType = .indoor
        do {
            let session = try HKWorkoutSession(healthStore: store, configuration: config)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: config)
            session.delegate = self
            builder.delegate = self
            self.session = session
            self.builder = builder
            samples = []
            let now = Date()
            session.startActivity(with: now)
            builder.beginCollection(withStart: now) { _, _ in }
        } catch {
            print("[workout] could not start: \(error)")
        }
    }

    /// End the session and send the whole heart-rate series to the phone.
    func stop() {
        guard let session, let builder else {
            sendSeries()
            return
        }
        self.session = nil
        self.builder = nil
        session.end()
        builder.endCollection(withEnd: Date()) { [weak self] _, _ in
            builder.discardWorkout()
            DispatchQueue.main.async { self?.sendSeries() }
        }
    }

    private func sendSeries() {
        PhoneLink.shared.send(["series": samples])
    }

    // MARK: HKLiveWorkoutBuilderDelegate

    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        guard let heartRateType, collectedTypes.contains(heartRateType),
              let quantity = workoutBuilder.statistics(for: heartRateType)?.mostRecentQuantity() else { return }
        let bpm = quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute())).rounded()
        let t = (Date().timeIntervalSince1970 * 1000).rounded()
        samples.append(["t": t, "bpm": bpm])
        DispatchQueue.main.async { WatchModel.shared.heartRate = bpm }
        PhoneLink.shared.sendLive(["hr": bpm, "t": t])
    }

    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    // MARK: HKWorkoutSessionDelegate

    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState,
                        from fromState: HKWorkoutSessionState, date: Date) {}

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        print("[workout] failed: \(error)")
    }
}
