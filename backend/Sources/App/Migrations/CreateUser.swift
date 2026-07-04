import Fluent

struct CreateUser: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("users")
            .id()
            .field("name", .string, .required)
            .field("phone_number", .string)
            .field("email", .string, .required)
            .field("password_hash", .string, .required)
            .field("timezone", .string, .required)
            .field("sms_reminders_enabled", .bool, .required, .sql(.default(true)))
            .field("last_prompt_type", .string)
            .field("last_prompt_at", .datetime)
            .field("created_at", .datetime)
            .field("updated_at", .datetime)
            .unique(on: "email")
            .unique(on: "phone_number")
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("users").delete()
    }
}
