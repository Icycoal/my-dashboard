import Vapor
import Fluent
import JWT

final class User: Model, Content, @unchecked Sendable {
    static let schema = "users"

    @ID(key: .id) var id: UUID?
    @Field(key: "name") var name: String
    @OptionalField(key: "phone_number") var phoneNumber: String?
    @Field(key: "email") var email: String
    @Field(key: "password_hash") var passwordHash: String
    @Field(key: "timezone") var timezone: String
    @Field(key: "sms_reminders_enabled") var smsRemindersEnabled: Bool
    @OptionalField(key: "last_prompt_type") var lastPromptType: String?
    @OptionalField(key: "last_prompt_at") var lastPromptAt: Date?
    @Timestamp(key: "created_at", on: .create) var createdAt: Date?
    @Timestamp(key: "updated_at", on: .update) var updatedAt: Date?

    init() {}

    init(id: UUID? = nil, name: String, email: String, passwordHash: String,
         phoneNumber: String? = nil, timezone: String = "America/New_York") {
        self.id = id
        self.name = name
        self.email = email
        self.passwordHash = passwordHash
        self.phoneNumber = phoneNumber
        self.timezone = timezone
        self.smsRemindersEnabled = true
    }
}

// MARK: - JWT Auth

struct UserToken: JWTPayload, Authenticatable {
    var sub: SubjectClaim      // user id
    var exp: ExpirationClaim

    func verify(using signer: JWTSigner) throws {
        try exp.verifyNotExpired()
    }
}

extension User: Authenticatable {}

struct UserAuthenticator: AsyncJWTAuthenticator {
    typealias Payload = UserToken

    func authenticate(jwt: UserToken, for request: Request) async throws {
        guard let userId = UUID(uuidString: jwt.sub.value),
              let user = try await User.find(userId, on: request.db) else {
            return
        }
        request.auth.login(user)
    }
}
