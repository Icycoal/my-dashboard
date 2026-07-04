import Fluent

struct CreateFoodLog: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("food_logs")
            .id()
            .field("user_id", .uuid, .required, .references("users", "id", onDelete: .cascade))
            .field("meal_type", .string)
            .field("logged_at", .datetime, .required)
            .field("notes", .string)
            .field("source", .string, .required)
            .field("created_at", .datetime)
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("food_logs").delete()
    }
}
