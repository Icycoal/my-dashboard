import Vapor
import Fluent

final class FinanceStateRecord: Model, Content, @unchecked Sendable {
    static let schema = "finance_states"

    @ID(key: .id) var id: UUID?
    @Parent(key: "user_id") var user: User
    @Field(key: "data") var data: String
    @Timestamp(key: "updated_at", on: .update) var updatedAt: Date?
    @Timestamp(key: "created_at", on: .create) var createdAt: Date?

    init() {}

    init(id: UUID? = nil, userId: UUID, data: String) {
        self.id = id
        self.$user.id = userId
        self.data = data
    }
}
