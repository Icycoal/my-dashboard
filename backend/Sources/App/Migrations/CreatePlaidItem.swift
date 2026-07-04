import Fluent

struct CreatePlaidItem: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("plaid_items")
            .id()
            .field("user_id", .uuid, .required, .references("users", "id", onDelete: .cascade))
            .field("access_token", .string, .required)
            .field("item_id", .string, .required)
            .field("institution_id", .string, .required)
            .field("institution_name", .string, .required)
            .field("accounts_json", .string, .required)
            .field("sync_cursor", .string)
            .field("last_synced_at", .datetime)
            .field("created_at", .datetime)
            .field("updated_at", .datetime)
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("plaid_items").delete()
    }
}
