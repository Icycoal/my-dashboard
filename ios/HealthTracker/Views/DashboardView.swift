import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var api: APIClient
    @State private var summary: DashboardSummary?
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                Section("Today") {
                    HStack {
                        Label("Calories", systemImage: "flame.fill").foregroundStyle(.orange)
                        Spacer()
                        Text(Int(summary?.todayCalories ?? 0).formatted()).bold()
                    }
                    HStack {
                        Label("Protein", systemImage: "leaf.fill").foregroundStyle(.green)
                        Spacer()
                        Text("\(Int(summary?.todayProteinG ?? 0)) g").bold()
                    }
                }

                Section("Latest Weight") {
                    if let w = summary?.latestWeightLbs {
                        HStack {
                            Text("\(w, specifier: "%.1f") lbs").font(.title2.bold())
                            Spacer()
                            if let d = summary?.latestWeightDate {
                                Text(d, style: .date).foregroundStyle(.secondary)
                            }
                        }
                    } else {
                        Text("No entries yet").foregroundStyle(.secondary)
                    }
                }

                Section("Recent Workouts") {
                    if let ws = summary?.recentWorkouts, !ws.isEmpty {
                        ForEach(ws) { w in
                            VStack(alignment: .leading) {
                                Text(w.name ?? "Workout").font(.headline)
                                Text("\(w.exerciseCount) exercise\(w.exerciseCount == 1 ? "" : "s") • \(w.startedAt, style: .date)")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    } else {
                        Text("No workouts yet").foregroundStyle(.secondary)
                    }
                }

                if let error {
                    Text(error).foregroundStyle(.red)
                }
            }
            .navigationTitle("Dashboard")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Log Out") { api.logout() }
                }
            }
            .refreshable { await reload() }
            .task { await reload() }
        }
    }

    func reload() async {
        loading = true; error = nil
        do {
            summary = try await api.dashboardSummary()
        } catch { self.error = error.localizedDescription }
        loading = false
    }
}
