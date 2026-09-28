import SwiftUI
import WatchKit
import HealthKit

final class WatchDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() {
        PhoneLink.shared.activate()
    }

    /// The iPhone launched us for Power Hour (HKHealthStore.startWatchApp): start measuring right away.
    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        WorkoutManager.shared.start()
    }
}

@main
struct NicdokuWatchApp: App {
    @WKApplicationDelegateAdaptor(WatchDelegate.self) private var delegate
    @StateObject private var model = WatchModel.shared

    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(model)
        }
    }
}

// MARK: - Palette (matches the phone)

enum Palette {
    static let cream = Color(red: 0.969, green: 0.945, blue: 0.925)
    static let ink = Color(red: 0.478, green: 0.333, blue: 0.282)
    static let accent = Color(red: 0.949, green: 0.573, blue: 0.184)
    static let hot = Color(red: 1.0, green: 0.31, blue: 0.48)
    static let night = Color(red: 0.133, green: 0.067, blue: 0.173)
    static let calm = Color(red: 0.553, green: 0.788, blue: 0.643)
}

struct RootView: View {
    @EnvironmentObject var model: WatchModel

    var body: some View {
        switch model.phase {
        case "playing": PowerView()
        case "time": TimeView()
        case "breathe": BreatheView()
        case "done": DoneView()
        default: IdleView()
        }
    }
}

// MARK: - Idle: break status + streak

struct IdleView: View {
    @EnvironmentObject var model: WatchModel

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { context in
            let status = model.status.current(at: context.date)
            VStack(spacing: 6) {
                Image(systemName: icon(status.state))
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(status.state == "open" ? Palette.accent : .secondary)
                Text(title(status))
                    .font(.system(.headline, design: .rounded))
                    .multilineTextAlignment(.center)
                if status.state == "cooling", let until = status.untilDate {
                    Text(until, style: .time)
                        .font(.system(.title3, design: .rounded).weight(.bold))
                }
                Text("\(status.streak) of the last 7 days")
                    .font(.system(.footnote, design: .rounded))
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
    }

    private func icon(_ state: String) -> String {
        switch state {
        case "cooling": return "hourglass"
        case "resting": return "moon.zzz.fill"
        case "power": return "bolt.fill"
        default: return "square.grid.3x3.fill"
        }
    }

    private func title(_ s: NicdokuStatus) -> String {
        switch s.state {
        case "cooling": return "Next break from"
        case "resting": return "All done for today"
        case "power": return "Power Hour"
        default: return "A break's ready"
        }
    }
}

// MARK: - Power Hour on the wrist

struct PowerView: View {
    @EnvironmentObject var model: WatchModel

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            if let plan = model.plan {
                let p = plan.progress(at: context.date)
                let left = max(0, plan.endsAt.timeIntervalSince(context.date))
                ZStack {
                    LinearGradient(colors: [Palette.night.opacity(0.35 + 0.65 * p), Palette.hot.opacity(0.15 + 0.45 * p * p)],
                                   startPoint: .top, endPoint: .bottom)
                        .ignoresSafeArea()
                    VStack(spacing: 4) {
                        Text(plan.stage(at: context.date)?.name.uppercased() ?? "")
                            .font(.system(.caption2, design: .rounded).weight(.bold))
                            .foregroundStyle(.white.opacity(0.8))
                        Text(clock(left))
                            .font(.system(size: 40, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(.white)
                        ProgressView(value: p)
                            .tint(Palette.hot)
                        HStack {
                            Label("\(model.combo)", systemImage: "flame.fill")
                                .foregroundStyle(model.combo >= 2 ? Palette.accent : .white.opacity(0.7))
                            Spacer()
                            if let hr = model.heartRate {
                                Label("\(Int(hr))", systemImage: "heart.fill")
                                    .foregroundStyle(Palette.hot)
                            }
                        }
                        .font(.system(.body, design: .rounded).weight(.semibold))
                        Text("\(model.solved) solved · \(model.score)")
                            .font(.system(.footnote, design: .rounded))
                            .foregroundStyle(.white.opacity(0.75))
                    }
                    .padding(.horizontal, 8)
                }
            }
        }
    }

    private func clock(_ s: TimeInterval) -> String {
        let t = Int(s.rounded(.up))
        return String(format: "%d:%02d", t / 60, t % 60)
    }
}

struct TimeView: View {
    @State private var landed = false

    var body: some View {
        ZStack {
            Palette.night.ignoresSafeArea()
            Text("TIME.")
                .font(.system(size: 46, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .scaleEffect(landed ? 1 : 2.6)
                .opacity(landed ? 1 : 0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.55)) { landed = true }
        }
    }
}

/// In for 4 s, out for 6 s — with gentle wrist taps from WatchModel.
struct BreatheView: View {
    @State private var inhale = false

    var body: some View {
        VStack(spacing: 10) {
            Circle()
                .fill(Palette.calm.gradient)
                .frame(width: 110, height: 110)
                .scaleEffect(inhale ? 1 : 0.6)
            Text(inhale ? "Breathe in" : "and out")
                .font(.system(.headline, design: .rounded))
        }
        .onAppear { cycle() }
    }

    private func cycle() {
        withAnimation(.easeInOut(duration: 4)) { inhale = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
            withAnimation(.easeInOut(duration: 6)) { inhale = false }
            DispatchQueue.main.asyncAfter(deadline: .now() + 6) { cycle() }
        }
    }
}

struct DoneView: View {
    @EnvironmentObject var model: WatchModel

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "bolt.fill").font(.title2).foregroundStyle(Palette.accent)
            Text("Power Hour done").font(.system(.headline, design: .rounded))
            Text("\(model.solved) puzzles · \(model.score)")
                .font(.system(.footnote, design: .rounded))
                .foregroundStyle(.secondary)
            Button("See you tomorrow") { model.reset() }
                .tint(Palette.accent)
        }
        .padding()
    }
}
