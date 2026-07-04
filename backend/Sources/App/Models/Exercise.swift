import Vapor
import Fluent

final class Exercise: Model, Content, @unchecked Sendable {
    static let schema = "exercises"

    @ID(key: .id) var id: UUID?
    @Parent(key: "workout_id") var workout: Workout
    @Field(key: "name") var name: String
    @Field(key: "exercise_type") var exerciseType: String  // strength | cardio | flexibility
    @Field(key: "sort_order") var sortOrder: Int
    @Children(for: \.$exercise) var sets: [ExerciseSet]
    @Timestamp(key: "created_at", on: .create) var createdAt: Date?

    init() {}

    init(id: UUID? = nil, workoutId: UUID, name: String, exerciseType: String, sortOrder: Int = 0) {
        self.id = id
        self.$workout.id = workoutId
        self.name = name
        self.exerciseType = exerciseType
        self.sortOrder = sortOrder
    }
}
