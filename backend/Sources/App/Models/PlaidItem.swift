import Vapor
import Fluent

/// One row per connected Plaid institution per user.
/// `access_token` must be kept server-side; it is NEVER returned to the client.
final class PlaidItem: Model, @unchecked Sendable {
    static let schema = "plaid_items"

    @ID(key: .id) var id: UUID?
    @Parent(key: "user_id") var user: User

    /// Plaid access token – server-side only, never sent to client.
    @Field(key: "access_token") var accessToken: String

    /// Plaid item_id.
    @Field(key: "item_id") var itemId: String

    @Field(key: "institution_id") var institutionId: String
    @Field(key: "institution_name") var institutionName: String

    /// JSON-encoded array of linked sub-accounts (id, name, type, subtype, mask).
    @Field(key: "accounts_json") var accountsJson: String

    /// Cursor for /transactions/sync (nil before first sync).
    @OptionalField(key: "sync_cursor") var syncCursor: String?

    @OptionalField(key: "last_synced_at") var lastSyncedAt: Date?
    @Timestamp(key: "created_at", on: .create) var createdAt: Date?
    @Timestamp(key: "updated_at", on: .update) var updatedAt: Date?

    init() {}

    init(id: UUID? = nil,
         userId: UUID,
         accessToken: String,
         itemId: String,
         institutionId: String,
         institutionName: String,
         accountsJson: String) {
        self.id = id
        self.$user.id = userId
        self.accessToken = accessToken
        self.itemId = itemId
        self.institutionId = institutionId
        self.institutionName = institutionName
        self.accountsJson = accountsJson
    }
}

// MARK: - Client-safe response DTO (no access token)

struct PlaidAccountResponse: Content {
    let id: String
    let institutionId: String
    let institutionName: String
    let accounts: [LinkedAccount]
    let lastSynced: String?

    struct LinkedAccount: Content {
        let id: String
        let name: String
        let type: String
        let subtype: String?
        let mask: String?
    }
}
