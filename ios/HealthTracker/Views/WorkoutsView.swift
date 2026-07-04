import SwiftUI

struct WorkoutsView: View {
    @EnvironmentObject var api: APIClient
    @State private var workouts: [Workout] = []
    @State private var showingLog = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                ForEach(workouts) { w in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(w.name ?? "Workout").font(.headline)
                        Text(w.startedAt, style: .date).font(.caption).foregroundStyle(.secondary)
                        ForEach(w.exercises) { ex in
                            HStack {
                                Text("• \(ex.name)")
                                Spacer()
                                Text("\(ex.sets.count) set\(ex.sets.count == 1 ? "" : "s")")
                                    .foregroundStyle(.secondary).font(.caption)
                            }
                        }
                    }.padding(.vertical, 4)
                }
                .onDelete { idx in Task { await delete(at: idx) } }
            }
            .navigationTitle("Workouts")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingLog = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingLog) {
                LogWorkoutView { Task { await reload() } }
            }
            .refreshable { await reload() }
            .task { await reload() }
        }
    }

    func reload() async {
        do { workouts = try await api.listWorkouts() }
        catch { self.error = error.localizedDescription }
    }

    func delete(at offsets: IndexSet) async {
        for i in offsets {
            try? await api.deleteWorkout(id: workouts[i].id)
        }
        await reload()
    }
}

struct LogWorkoutView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var api: APIClient
    let onDone: () -> Void

    @State private var name = ""
    @State private var durationMin = ""
    @State private var exercises: [ExerciseDraft] = []
    @State private var saving = false
    @State private var error: String?

    struct ExerciseDraft: Identifiable {
        let id = UUID()
        var name = ""
        var type = "strength"
        var sets: [SetDraft] = [SetDraft()]
    }
    struct SetDraft: Identifiable {
        let id = UUID()
        var reps = ""
        var weight = ""
        var duration = ""
        var distance = ""
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Workout") {
                    TextField("Name (e.g., Leg Day)", text: $name)
                    TextField("Duration (min, optional)", text: $durationMin)
                        .keyboardType(.numberPad)
                }

                ForEach($exercises) { $ex in
                    Section("Exercise") {
                        TextField("Name", text: $ex.name)
                        Picker("Type", selection: $ex.type) {
                            Text("Strength").tag("strength")
                            Text("Cardio").tag("cardio")
                            Text("Flexibility").tag("flexibility")
                        }
                        ForEach($ex.sets) { $s in
                            if ex.type == "cardio" {
                                HStack {
                                    TextField("Min", text: $s.duration).keyboardType(.numberPad)
                                    TextField("Miles", text: $s.distance).keyboardType(.decimalPad)
                                }
                            } else {
                                HStack {
                                    TextField("Reps", text: $s.reps).keyboardType(.numberPad)
                                    TextField("Weight (lbs)", text: $s.weight).keyboardType(.decimalPad)
                                }
                            }
                        }
                        Button("+ Add set") {
                            ex.sets.append(SetDraft())
                        }
                    }
                }

                Button("+ Add exercise") {
                    exercises.append(ExerciseDraft())
                }

                if let error { Text(error).foregroundStyle(.red) }
            }
            .navigationTitle("New Workout")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") { Task { await save() } }
                        .disabled(saving || exercises.isEmpty)
                }
            }
        }
    }

    func save() async {
        saving = true; error = nil
        let exList: [APIClient.NewExercise] = exercises.map { ex in
            let sets = ex.sets.enumerated().map { idx, s in
                APIClient.NewSet(
                    setNumber: idx + 1,
                    reps: Int(s.reps),
                    weightLbs: Double(s.weight),
                    durationSeconds: Int(s.duration).map { $0 * 60 },
                    distanceMiles: Double(s.distance)
                )
            }
            return APIClient.NewExercise(name: ex.name, exerciseType: ex.type,
                                         sortOrder: nil, sets: sets)
        }
        let body = APIClient.CreateWorkout(
            name: name.isEmpty ? nil : name,
            startedAt: nil, endedAt: nil,
            durationMinutes: Int(durationMin),
            notes: nil, exercises: exList
        )
        do {
            _ = try await api.createWorkout(body)
            onDone()
            dismiss()
        } catch { self.error = error.localizedDescription }
        saving = false
    }
}
