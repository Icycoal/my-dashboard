import Vapor
import Fluent

final class Workout: Model, Content, @unchecked Sendable {
    static let schema = "workouts"

    @ID(key: .id) var id: UUID?
    @Parent(key: "user_id") var user: User
    @OptionalField(key: "name") var name: String?
    @Field(key: "started_at") var startedAt: Date
    @OptionalField(key: "ended_at") var endedAt: Date?
    @OptionalField(key: "duration_minutes") var durationMinutes: Int?
    @OptionalField(key: "notes") var notes: String?
    @Field(key: "source") var source: String
    @Children(for: \.$workout) var exercises: [Exercise]
    @Timestamp(key: "created_at", on: .create) var createdAt: Date?

    init() {}

    init(id: UUID? = nil, userId: UUID, name: String? = nil, startedAt: Date,
         endedAt: Date? = nil, durationMinutes: Int? = nil, notes: String? = nil, source: String = "app") {
        self.id = id
        self.$user.id = userId
        self.name = name
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.durationMinutes = durationMinutes
        self.notes = notes
        self.source = source
    }
}
