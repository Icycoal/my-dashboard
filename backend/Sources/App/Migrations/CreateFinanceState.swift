import Fluent

struct CreateFinanceState: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("finance_states")
            .id()
            .field("user_id", .uuid, .required, .references("users", "id", onDelete: .cascade))
            .field("data", .string, .required)
            .field("created_at", .datetime)
            .field("updated_at", .datetime)
            .unique(on: "user_id")
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("finance_states").delete()
    }
}
