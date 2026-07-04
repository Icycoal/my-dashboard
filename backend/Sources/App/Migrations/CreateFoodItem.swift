import Fluent

struct CreateFoodItem: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("food_items")
            .id()
            .field("food_log_id", .uuid, .required, .references("food_logs", "id", onDelete: .cascade))
            .field("name", .string, .required)
            .field("usda_fdc_id", .int)
            .field("serving_size", .double)
            .field("serving_unit", .string)
            .field("calories", .double)
            .field("protein_g", .double)
            .field("carbs_g", .double)
            .field("fat_g", .double)
            .field("fiber_g", .double)
            .field("raw_description", .string)
            .field("created_at", .datetime)
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("food_items").delete()
    }
}
