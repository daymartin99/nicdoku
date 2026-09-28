import SwiftUI
import WidgetKit

/// Watch-face complication: is a break open, when the next one opens, or resting today; plus streak.
struct StatusEntry: TimelineEntry {
    let date: Date
    let status: NicdokuStatus
}

struct StatusProvider: TimelineProvider {
    func placeholder(in context: Context) -> StatusEntry {
        StatusEntry(date: .now, status: NicdokuStatus(state: "open", until: nil, streak: 5, label: "Break open"))
    }

    func getSnapshot(in context: Context, completion: @escaping (StatusEntry) -> Void) {
        completion(StatusEntry(date: .now, status: StatusStore.load().current()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StatusEntry>) -> Void) {
        let now = Date()
        let status = StatusStore.load()
        var entries = [StatusEntry(date: now, status: status.current(at: now))]
        let open = NicdokuStatus(state: "open", until: nil, streak: status.streak, label: "Break open")
        if status.state == "cooling", let until = status.untilDate, until > now {
            entries.append(StatusEntry(date: until, status: open)) // flips by itself when the rest ends
        }
        if status.state == "resting", let midnight = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: now)) {
            entries.append(StatusEntry(date: midnight, status: open))
        }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(60 * 60))))
    }
}

struct ComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let entry: StatusEntry

    private var icon: String {
        switch entry.status.state {
        case "cooling": return "hourglass"
        case "resting": return "moon.zzz.fill"
        case "power": return "bolt.fill"
        default: return "square.grid.3x3.fill"
        }
    }

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 1) {
                    Image(systemName: icon).font(.system(size: 15, weight: .semibold))
                    if entry.status.state == "cooling", let until = entry.status.untilDate {
                        Text(until, style: .time).font(.system(size: 10, weight: .semibold)).minimumScaleFactor(0.6)
                    } else {
                        Text("\(entry.status.streak)/7").font(.system(size: 11, weight: .semibold))
                    }
                }
            }
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Label("Nicdoku", systemImage: icon).font(.headline)
                if entry.status.state == "cooling", let until = entry.status.untilDate {
                    Text("Next break \(until, style: .time)")
                } else {
                    Text(entry.status.label)
                }
                Text("\(entry.status.streak) of last 7 days").foregroundStyle(.secondary)
            }
        case .accessoryInline:
            Text("Nicdoku · \(entry.status.label)")
        default: // .accessoryCorner
            Image(systemName: icon)
                .widgetLabel { Text(entry.status.label) }
        }
    }
}

@main
struct NicdokuComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NicdokuComplication", provider: StatusProvider()) { entry in
            ComplicationView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Nicdoku")
        .description("Whether a break is open, and your week so far.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
    }
}
