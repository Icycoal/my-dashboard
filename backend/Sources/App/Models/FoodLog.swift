import Vapor
import Fluent

final class FoodLog: Model, Content, @unchecked Sendable {
    static let schema = "food_logs"

    @ID(key: .id) var id: UUID?
    @Parent(key: "user_id") var user: User
    @OptionalField(key: "meal_type") var mealType: String?  // breakfast | lunch | dinner | snack
    @Field(key: "logged_at") var loggedAt: Date
    @OptionalField(key: "notes") var notes: String?
    @Field(key: "source") var source: String
    @Children(for: \.$foodLog) var items: [FoodItem]
    @Timestamp(key: "created_at", on: .create) var createdAt: Date?

    init() {}

    init(id: UUID? = nil, userId: UUID, mealType: String? = nil, loggedAt: Date,
         notes: String? = nil, source: String = "app") {
        self.id = id
        self.$user.id = userId
        self.mealType = mealType
        self.loggedAt = loggedAt
        self.notes = notes
        self.source = source
    }
}
