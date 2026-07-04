import Fluent

struct CreateExercise: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("exercises")
            .id()
            .field("workout_id", .uuid, .required, .references("workouts", "id", onDelete: .cascade))
            .field("name", .string, .required)
            .field("exercise_type", .string, .required)
            .field("sort_order", .int, .required)
            .field("created_at", .datetime)
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("exercises").delete()
    }
}
