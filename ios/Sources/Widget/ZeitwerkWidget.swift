import SwiftUI
import WidgetKit

struct ClockEntry: TimelineEntry {
    let date: Date
    let snapshot: ClockSnapshot
}

struct ClockProvider: TimelineProvider {
    func placeholder(in context: Context) -> ClockEntry {
        ClockEntry(date: .now, snapshot: ClockSnapshot(kind: "travel", project: "Dienstreise",
                                                       startedAt: .now.addingTimeInterval(-2520), updatedAt: .now))
    }

    func getSnapshot(in context: Context, completion: @escaping (ClockEntry) -> Void) {
        completion(ClockEntry(date: .now, snapshot: ClockStore.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ClockEntry>) -> Void) {
        let entry = ClockEntry(date: .now, snapshot: ClockStore.read())
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(15 * 60))))
    }
}

struct ClockWidgetView: View {
    let entry: ClockEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("zeitwerk", systemImage: "timer")
                .font(.headline)
                .foregroundStyle(.green)
            Spacer(minLength: 2)
            if entry.snapshot.isRunning, let start = entry.snapshot.startedAt {
                Text(entry.snapshot.kind == "travel" ? "REISEZEIT" : "ARBEITSZEIT")
                    .font(.caption2).foregroundStyle(.secondary)
                Text(start, style: .timer)
                    .font(.title2.bold())
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text(entry.snapshot.project)
                    .font(.caption)
                    .lineLimit(1)
            } else {
                Text("Keine Erfassung aktiv")
                    .font(.subheadline.weight(.medium))
                Text("Zeitwerk öffnen, um zu starten")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct ZeitwerkClockWidget: Widget {
    let kind = "ZeitwerkClock"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ClockProvider()) { entry in
            ClockWidgetView(entry: entry)
        }
        .configurationDisplayName("Zeitwerk Status")
        .description("Arbeits- oder Reisezeit im Blick")
        .supportedFamilies([.systemSmall])
    }
}

@main
struct ZeitwerkWidgets: WidgetBundle {
    var body: some Widget { ZeitwerkClockWidget() }
}
