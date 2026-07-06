import Fluent

struct CreateFinanceTransaction: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("finance_transactions")
            .id()
            .field("user_id", .uuid, .required, .references("users", "id", onDelete: .cascade))
            .field("client_id", .string, .required)
            .field("category", .string, .required)
            .field("amount", .double, .required)
            .field("year", .int, .required)
            .field("month", .int, .required)
            .field("day", .int, .required)
            .field("data", .string, .required)
            .field("created_at", .datetime)
            .field("updated_at", .datetime)
            .unique(on: "user_id", "client_id")
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("finance_transactions").delete()
    }
}
