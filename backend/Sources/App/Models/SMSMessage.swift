import Vapor
import Fluent

final class SMSMessage: Model, Content, @unchecked Sendable {
    static let schema = "sms_messages"

    @ID(key: .id) var id: UUID?
    @OptionalParent(key: "user_id") var user: User?
    @Field(key: "from_number") var fromNumber: String
    @Field(key: "to_number") var toNumber: String
    @Field(key: "body") var body: String
    @Field(key: "direction") var direction: String  // inbound | outbound
    @OptionalField(key: "twilio_sid") var twilioSid: String?
    @OptionalField(key: "parsed_type") var parsedType: String?
    @OptionalField(key: "processed_at") var processedAt: Date?
    @Timestamp(key: "created_at", on: .create) var createdAt: Date?

    init() {}

    init(id: UUID? = nil, userId: UUID? = nil, fromNumber: String, toNumber: String,
         body: String, direction: String, twilioSid: String? = nil) {
        self.id = id
        self.$user.id = userId
        self.fromNumber = fromNumber
        self.toNumber = toNumber
        self.body = body
        self.direction = direction
        self.twilioSid = twilioSid
    }
}
