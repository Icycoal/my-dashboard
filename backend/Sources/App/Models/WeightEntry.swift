import Vapor
import Fluent

final class WeightEntry: Model, Content, @unchecked Sendable {
    static let schema = "weight_entries"

    @ID(key: .id) var id: UUID?
    @Parent(key: "user_id") var user: User
    @Field(key: "weight_lbs") var weightLbs: Double
    @Field(key: "logged_at") var loggedAt: Date
    @Field(key: "source") var source: String
    @Timestamp(key: "created_at", on: .create) var createdAt: Date?

    init() {}

    init(id: UUID? = nil, userId: UUID, weightLbs: Double, loggedAt: Date, source: String = "app") {
        self.id = id
        self.$user.id = userId
        self.weightLbs = weightLbs
        self.loggedAt = loggedAt
        self.source = source
    }
}
