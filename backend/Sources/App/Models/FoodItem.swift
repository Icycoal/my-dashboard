import Vapor
import Fluent

final class FoodItem: Model, Content, @unchecked Sendable {
    static let schema = "food_items"

    @ID(key: .id) var id: UUID?
    @Parent(key: "food_log_id") var foodLog: FoodLog
    @Field(key: "name") var name: String
    @OptionalField(key: "usda_fdc_id") var usdaFdcId: Int?
    @OptionalField(key: "serving_size") var servingSize: Double?
    @OptionalField(key: "serving_unit") var servingUnit: String?
    @OptionalField(key: "calories") var calories: Double?
    @OptionalField(key: "protein_g") var proteinG: Double?
    @OptionalField(key: "carbs_g") var carbsG: Double?
    @OptionalField(key: "fat_g") var fatG: Double?
    @OptionalField(key: "fiber_g") var fiberG: Double?
    @OptionalField(key: "raw_description") var rawDescription: String?
    @Timestamp(key: "created_at", on: .create) var createdAt: Date?

    init() {}

    init(id: UUID? = nil, foodLogId: UUID, name: String, calories: Double? = nil) {
        self.id = id
        self.$foodLog.id = foodLogId
        self.name = name
        self.calories = calories
    }
}
