import Fluent

struct CreateExerciseSet: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("exercise_sets")
            .id()
            .field("exercise_id", .uuid, .required, .references("exercises", "id", onDelete: .cascade))
            .field("set_number", .int, .required)
            .field("reps", .int)
            .field("weight_lbs", .double)
            .field("duration_seconds", .int)
            .field("distance_miles", .double)
            .field("created_at", .datetime)
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("exercise_sets").delete()
    }
}
