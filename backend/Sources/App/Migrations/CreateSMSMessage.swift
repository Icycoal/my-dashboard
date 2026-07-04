import Fluent

struct CreateSMSMessage: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("sms_messages")
            .id()
            .field("user_id", .uuid, .references("users", "id", onDelete: .setNull))
            .field("from_number", .string, .required)
            .field("to_number", .string, .required)
            .field("body", .string, .required)
            .field("direction", .string, .required)
            .field("twilio_sid", .string)
            .field("parsed_type", .string)
            .field("processed_at", .datetime)
            .field("created_at", .datetime)
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("sms_messages").delete()
    }
}
