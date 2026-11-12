import SwiftUI

@main
struct ZeitwerkNativeApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
    }
}

struct ContentView: View {
    @State private var snapshot = ClockStore.read()
    @State private var project = "Dienstreise"

    var body: some View {
        NavigationStack {
            Form {
                Section("Widget-Vorschau") {
                    Label(snapshot.isRunning ? "Erfassung aktiv" : "Keine Erfassung aktiv",
                          systemImage: snapshot.isRunning ? "timer" : "pause.circle")
                    if snapshot.isRunning, let start = snapshot.startedAt {
                        Text(start, style: .timer).monospacedDigit()
                        Text(snapshot.project)
                    }
                    TextField("Projekt", text: $project)
                    Button("Demo-Reisezeit starten") {
                        snapshot = ClockSnapshot(kind: "travel", project: project,
                                                 startedAt: .now, updatedAt: .now)
                        ClockStore.write(snapshot)
                    }
                    Button("Demo beenden") {
                        snapshot = .idle
                        ClockStore.write(snapshot)
                    }
                }
                Section {
                    Text("Dies ist eine lokale Widget-Demo. Start/Stopp verändert keine Zeitwerk-Einträge und synchronisiert noch nicht mit Supabase.")
                        .font(.footnote)
                }
            }
            .navigationTitle("zeitwerk")
        }
    }
}
