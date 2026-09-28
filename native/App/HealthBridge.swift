import Foundation
import HealthKit

/// iPhone-side Apple Health: permission, Mindful Minutes, and launching the Watch app.
final class HealthBridge {
    static let shared = HealthBridge()
    let store = HKHealthStore()

    private var mindful: HKCategoryType? { HKObjectType.categoryType(forIdentifier: .mindfulSession) }
    private var heartRate: HKQuantityType? { HKObjectType.quantityType(forIdentifier: .heartRate) }

    func requestAuthorization(_ done: @escaping (Bool) -> Void) {
        guard HKHealthStore.isHealthDataAvailable(), let mindful, let heartRate else {
            done(false)
            return
        }
        let share: Set<HKSampleType> = [mindful, HKObjectType.workoutType()]
        let read: Set<HKObjectType> = [heartRate]
        store.requestAuthorization(toShare: share, read: read) { ok, _ in
            DispatchQueue.main.async { done(ok) }
        }
    }

    /// Opens the Watch app in its workout (heart-rate) mode. Fails quietly if there's no Watch.
    func launchWatchApp(_ done: @escaping (Bool) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            done(false)
            return
        }
        let config = HKWorkoutConfiguration()
        config.activityType = .mindAndBody
        config.locationType = .indoor
        store.startWatchApp(with: config) { ok, _ in
            DispatchQueue.main.async { done(ok) }
        }
    }

    /// A break or wind-down as a Mindful Minutes sample in Apple Health.
    func saveMindful(start: Date, end: Date, _ done: @escaping () -> Void) {
        guard let mindful, end > start, store.authorizationStatus(for: mindful) == .sharingAuthorized else {
            done()
            return
        }
        let sample = HKCategorySample(type: mindful,
                                      value: HKCategoryValue.notApplicable.rawValue,
                                      start: start,
                                      end: end)
        store.save(sample) { _, _ in DispatchQueue.main.async { done() } }
    }
}
