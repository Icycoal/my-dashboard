import SwiftUI

struct FoodView: View {
    @EnvironmentObject var api: APIClient
    @State private var logs: [FoodLog] = []
    @State private var showingLog = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                ForEach(logs) { log in
                    Section(header: Text(sectionTitle(log))) {
                        ForEach(log.items) { item in
                            HStack {
                                Text(item.name)
                                Spacer()
                                if let c = item.calories {
                                    Text("\(Int(c)) cal").foregroundStyle(.secondary)
                                }
                            }
                        }
                        HStack {
                            Text("Total").bold()
                            Spacer()
                            Text("\(Int(log.totalCalories)) cal").bold()
                        }
                    }
                }
            }
            .navigationTitle("Food")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingLog = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showingLog) {
                LogFoodView { Task { await reload() } }
            }
            .refreshable { await reload() }
            .task { await reload() }
        }
    }

    func sectionTitle(_ log: FoodLog) -> String {
        let meal = log.mealType?.capitalized ?? "Meal"
        let df = DateFormatter()
        df.dateStyle = .short; df.timeStyle = .short
        return "\(meal) — \(df.string(from: log.loggedAt))"
    }

    func reload() async {
        do { logs = try await api.listFoodLogs() }
        catch { self.error = error.localizedDescription }
    }
}

struct LogFoodView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var api: APIClient
    let onDone: () -> Void

    @State private var mealType = "lunch"
    @State private var searchQuery = ""
    @State private var results: [USDAFoodSummary] = []
    @State private var selected: [USDAFoodSummary] = []
    @State private var searching = false
    @State private var saving = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Picker("Meal", selection: $mealType) {
                    Text("Breakfast").tag("breakfast")
                    Text("Lunch").tag("lunch")
                    Text("Dinner").tag("dinner")
                    Text("Snack").tag("snack")
                }

                Section("Search Foods") {
                    HStack {
                        TextField("e.g., chicken breast", text: $searchQuery)
                        Button("Search") { Task { await search() } }
                            .disabled(searchQuery.isEmpty || searching)
                    }
                    ForEach(results) { r in
                        Button {
                            selected.append(r)
                        } label: {
                            VStack(alignment: .leading) {
                                Text(r.name).font(.subheadline)
                                if let cal = r.calories {
                                    Text("\(Int(cal)) cal" + (r.brand.map { " • \($0)" } ?? ""))
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }

                if !selected.isEmpty {
                    Section("Selected") {
                        ForEach(selected) { s in
                            HStack {
                                Text(s.name)
                                Spacer()
                                if let c = s.calories { Text("\(Int(c)) cal") }
                            }
                        }
                        .onDelete { idx in
                            selected.remove(atOffsets: idx)
                        }
                    }
                }

                if let error { Text(error).foregroundStyle(.red) }
            }
            .navigationTitle("Log Food")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") { Task { await save() } }
                        .disabled(saving || selected.isEmpty)
                }
            }
        }
    }

    func search() async {
        searching = true; error = nil
        do { results = try await api.searchFood(query: searchQuery) }
        catch { self.error = error.localizedDescription }
        searching = false
    }

    func save() async {
        saving = true; error = nil
        let items = selected.map { s in
            APIClient.NewFoodItem(
                name: s.name, usdaFdcId: s.fdcId,
                servingSize: s.servingSize, servingUnit: s.servingUnit,
                calories: s.calories, proteinG: s.proteinG, carbsG: s.carbsG,
                fatG: s.fatG, fiberG: s.fiberG, rawDescription: nil
            )
        }
        do {
            _ = try await api.createFoodLog(
                APIClient.CreateFoodLog(mealType: mealType, loggedAt: nil,
                                        notes: nil, items: items))
            onDone()
            dismiss()
        } catch { self.error = error.localizedDescription }
        saving = false
    }
}
