import Vapor
import Fluent

final class ExerciseSet: Model, Content, @unchecked Sendable {
    static let schema = "exercise_sets"

    @ID(key: .id) var id: UUID?
    @Parent(key: "exercise_id") var exercise: Exercise
    @Field(key: "set_number") var setNumber: Int
    @OptionalField(key: "reps") var reps: Int?
    @OptionalField(key: "weight_lbs") var weightLbs: Double?
    @OptionalField(key: "duration_seconds") var durationSeconds: Int?
    @OptionalField(key: "distance_miles") var distanceMiles: Double?
    @Timestamp(key: "created_at", on: .create) var createdAt: Date?

    init() {}

    init(id: UUID? = nil, exerciseId: UUID, setNumber: Int,
         reps: Int? = nil, weightLbs: Double? = nil,
         durationSeconds: Int? = nil, distanceMiles: Double? = nil) {
        self.id = id
        self.$exercise.id = exerciseId
        self.setNumber = setNumber
        self.reps = reps
        self.weightLbs = weightLbs
        self.durationSeconds = durationSeconds
        self.distanceMiles = distanceMiles
    }
}
