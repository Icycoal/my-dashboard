import Vapor
import Fluent

/// One finance transaction as its own row. `data` holds the full client-owned
/// JSON object; the typed columns are extracted copies for querying/sorting.
final class FinanceTransaction: Model, @unchecked Sendable {
    static let schema = "finance_transactions"

    @ID(key: .id) var id: UUID?
    @Parent(key: "user_id") var user: User
    @Field(key: "client_id") var clientId: String
    @Field(key: "category") var category: String
    @Field(key: "amount") var amount: Double
    @Field(key: "year") var year: Int
    @Field(key: "month") var month: Int
    @Field(key: "day") var day: Int
    @Field(key: "data") var data: String
    @Timestamp(key: "updated_at", on: .update) var updatedAt: Date?
    @Timestamp(key: "created_at", on: .create) var createdAt: Date?

    init() {}

    init(userId: UUID, clientId: String) {
        self.$user.id = userId
        self.clientId = clientId
    }
}
