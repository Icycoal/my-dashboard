import Vapor
import Fluent

struct WorkoutController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let w = routes.grouped("workouts")
        w.get(use: list)
        w.post(use: create)
        w.get(":id", use: detail)
        w.put(":id", use: update)
        w.delete(":id", use: delete)
    }

    // MARK: - DTOs

    struct SetDTO: Content {
        let setNumber: Int?
        let reps: Int?
        let weightLbs: Double?
        let durationSeconds: Int?
        let distanceMiles: Double?
    }

    struct ExerciseDTO: Content {
        let name: String
        let exerciseType: String   // strength | cardio | flexibility
        let sortOrder: Int?
        let sets: [SetDTO]?
    }

    struct CreateDTO: Content {
        let name: String?
        let startedAt: Date?
        let endedAt: Date?
        let durationMinutes: Int?
        let notes: String?
        let exercises: [ExerciseDTO]?
    }

    struct UpdateDTO: Content {
        let name: String?
        let endedAt: Date?
        let durationMinutes: Int?
        let notes: String?
    }

    struct WorkoutResponse: Content {
        let id: UUID
        let name: String?
        let startedAt: Date
        let endedAt: Date?
        let durationMinutes: Int?
        let notes: String?
        let source: String
        let exercises: [ExerciseResponse]
    }

    struct ExerciseResponse: Content {
        let id: UUID
        let name: String
        let exerciseType: String
        let sortOrder: Int
        let sets: [SetResponse]
    }

    struct SetResponse: Content {
        let id: UUID
        let setNumber: Int
        let reps: Int?
        let weightLbs: Double?
        let durationSeconds: Int?
        let distanceMiles: Double?
    }

    // MARK: - Handlers

    @Sendable
    func list(req: Request) async throws -> [WorkoutResponse] {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()
        let limit = (try? req.query.get(Int.self, at: "limit")) ?? 50

        let workouts = try await Workout.query(on: req.db)
            .filter(\.$user.$id == userId)
            .sort(\.$startedAt, .descending)
            .limit(limit)
            .with(\.$exercises) { $0.with(\.$sets) }
            .all()

        return workouts.map(Self.toResponse)
    }

    @Sendable
    func detail(req: Request) async throws -> WorkoutResponse {
        let workout = try await resolveWorkout(req: req, loadChildren: true)
        return Self.toResponse(workout)
    }

    @Sendable
    func create(req: Request) async throws -> WorkoutResponse {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()
        let dto = try req.content.decode(CreateDTO.self)

        let workout = Workout(
            userId: userId,
            name: dto.name,
            startedAt: dto.startedAt ?? Date(),
            endedAt: dto.endedAt,
            durationMinutes: dto.durationMinutes,
            notes: dto.notes
        )

        try await req.db.transaction { db in
            try await workout.save(on: db)
            let workoutId = try workout.requireID()
            for (index, exDTO) in (dto.exercises ?? []).enumerated() {
                let exercise = Exercise(
                    workoutId: workoutId,
                    name: exDTO.name,
                    exerciseType: exDTO.exerciseType,
                    sortOrder: exDTO.sortOrder ?? index
                )
                try await exercise.save(on: db)
                let exerciseId = try exercise.requireID()
                for (setIdx, setDTO) in (exDTO.sets ?? []).enumerated() {
                    let set = ExerciseSet(
                        exerciseId: exerciseId,
                        setNumber: setDTO.setNumber ?? (setIdx + 1),
                        reps: setDTO.reps,
                        weightLbs: setDTO.weightLbs,
                        durationSeconds: setDTO.durationSeconds,
                        distanceMiles: setDTO.distanceMiles
                    )
                    try await set.save(on: db)
                }
            }
        }

        // Reload with children
        let loaded = try await Workout.query(on: req.db)
            .filter(\.$id == (try workout.requireID()))
            .with(\.$exercises) { $0.with(\.$sets) }
            .first()!
        return Self.toResponse(loaded)
    }

    @Sendable
    func update(req: Request) async throws -> WorkoutResponse {
        let workout = try await resolveWorkout(req: req, loadChildren: false)
        let dto = try req.content.decode(UpdateDTO.self)
        if let n = dto.name { workout.name = n }
        if let e = dto.endedAt { workout.endedAt = e }
        if let d = dto.durationMinutes { workout.durationMinutes = d }
        if let notes = dto.notes { workout.notes = notes }
        try await workout.save(on: req.db)

        let loaded = try await Workout.query(on: req.db)
            .filter(\.$id == (try workout.requireID()))
            .with(\.$exercises) { $0.with(\.$sets) }
            .first()!
        return Self.toResponse(loaded)
    }

    @Sendable
    func delete(req: Request) async throws -> HTTPStatus {
        let workout = try await resolveWorkout(req: req, loadChildren: false)
        try await workout.delete(on: req.db)
        return .noContent
    }

    // MARK: - Helpers

    private func resolveWorkout(req: Request, loadChildren: Bool) async throws -> Workout {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()
        guard let id = req.parameters.get("id", as: UUID.self) else {
            throw Abort(.badRequest, reason: "Invalid workout id")
        }
        var q = Workout.query(on: req.db)
            .filter(\.$id == id)
            .filter(\.$user.$id == userId)
        if loadChildren {
            q = q.with(\.$exercises) { $0.with(\.$sets) }
        }
        guard let workout = try await q.first() else {
            throw Abort(.notFound)
        }
        return workout
    }

    static func toResponse(_ w: Workout) -> WorkoutResponse {
        WorkoutResponse(
            id: w.id!,
            name: w.name,
            startedAt: w.startedAt,
            endedAt: w.endedAt,
            durationMinutes: w.durationMinutes,
            notes: w.notes,
            source: w.source,
            exercises: w.exercises
                .sorted { $0.sortOrder < $1.sortOrder }
                .map { ex in
                    ExerciseResponse(
                        id: ex.id!,
                        name: ex.name,
                        exerciseType: ex.exerciseType,
                        sortOrder: ex.sortOrder,
                        sets: ex.sets
                            .sorted { $0.setNumber < $1.setNumber }
                            .map { s in
                                SetResponse(
                                    id: s.id!,
                                    setNumber: s.setNumber,
                                    reps: s.reps,
                                    weightLbs: s.weightLbs,
                                    durationSeconds: s.durationSeconds,
                                    distanceMiles: s.distanceMiles
                                )
                            }
                    )
                }
        )
    }
}
