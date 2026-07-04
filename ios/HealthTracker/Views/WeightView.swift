import SwiftUI
import Charts

struct WeightView: View {
    @EnvironmentObject var api: APIClient
    @State private var entries: [WeightEntry] = []
    @State private var trend: [TrendPoint] = []
    @State private var newWeight = ""
    @State private var error: String?

    var body: some View {
        NavigationStack {
            VStack {
                if !trend.isEmpty {
                    Chart(trend, id: \.date) { point in
                        LineMark(x: .value("Date", point.date),
                                 y: .value("Weight", point.weightLbs))
                        PointMark(x: .value("Date", point.date),
                                  y: .value("Weight", point.weightLbs))
                    }
                    .frame(height: 200).padding()
                }

                HStack {
                    TextField("Weight in lbs", text: $newWeight)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                    Button("Log") { Task { await log() } }
                        .buttonStyle(.borderedProminent)
                        .disabled(Double(newWeight) == nil)
                }.padding(.horizontal)

                List {
                    ForEach(entries) { e in
                        HStack {
                            Text("\(e.weightLbs, specifier: "%.1f") lbs")
                            Spacer()
                            Text(e.loggedAt, style: .date).foregroundStyle(.secondary)
                        }
                    }
                    .onDelete { idx in
                        Task { await delete(at: idx) }
                    }
                }
            }
            .navigationTitle("Weight")
            .refreshable { await reload() }
            .task { await reload() }
            .overlay {
                if let error { Text(error).foregroundStyle(.red).padding() }
            }
        }
    }

    func reload() async {
        do {
            entries = try await api.listWeights()
            trend = try await api.weightTrend(days: 60)
        } catch { self.error = error.localizedDescription }
    }

    func log() async {
        guard let v = Double(newWeight) else { return }
        do {
            _ = try await api.createWeight(lbs: v)
            newWeight = ""
            await reload()
        } catch { self.error = error.localizedDescription }
    }

    func delete(at offsets: IndexSet) async {
        for i in offsets {
            do { try await api.deleteWeight(id: entries[i].id) }
            catch { self.error = error.localizedDescription }
        }
        await reload()
    }
}
