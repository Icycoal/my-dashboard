import Fluent

struct CreateWorkout: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("workouts")
            .id()
            .field("user_id", .uuid, .required, .references("users", "id", onDelete: .cascade))
            .field("name", .string)
            .field("started_at", .datetime, .required)
            .field("ended_at", .datetime)
            .field("duration_minutes", .int)
            .field("notes", .string)
            .field("source", .string, .required)
            .field("created_at", .datetime)
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("workouts").delete()
    }
}
