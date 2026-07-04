import Fluent

struct CreateWeightEntry: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("weight_entries")
            .id()
            .field("user_id", .uuid, .required, .references("users", "id", onDelete: .cascade))
            .field("weight_lbs", .double, .required)
            .field("logged_at", .datetime, .required)
            .field("source", .string, .required)
            .field("created_at", .datetime)
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("weight_entries").delete()
    }
}
