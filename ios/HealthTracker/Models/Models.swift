import Foundation

// Mirror backend DTOs

struct TokenResponse: Codable {
    let token: String
    let userId: UUID
    let name: String
    let email: String
}

struct WeightEntry: Codable, Identifiable, Hashable {
    let id: UUID
    let weightLbs: Double
    let loggedAt: Date
    let source: String
}

struct TrendPoint: Codable, Hashable {
    let date: Date
    let weightLbs: Double
}

struct Workout: Codable, Identifiable, Hashable {
    let id: UUID
    let name: String?
    let startedAt: Date
    let endedAt: Date?
    let durationMinutes: Int?
    let notes: String?
    let source: String
    let exercises: [Exercise]
}

struct Exercise: Codable, Identifiable, Hashable {
    let id: UUID
    let name: String
    let exerciseType: String
    let sortOrder: Int
    let sets: [ExerciseSet]
}

struct ExerciseSet: Codable, Identifiable, Hashable {
    let id: UUID
    let setNumber: Int
    let reps: Int?
    let weightLbs: Double?
    let durationSeconds: Int?
    let distanceMiles: Double?
}

struct FoodLog: Codable, Identifiable, Hashable {
    let id: UUID
    let mealType: String?
    let loggedAt: Date
    let notes: String?
    let source: String
    let totalCalories: Double
    let items: [FoodItem]
}

struct FoodItem: Codable, Identifiable, Hashable {
    let id: UUID
    let name: String
    let usdaFdcId: Int?
    let servingSize: Double?
    let servingUnit: String?
    let calories: Double?
    let proteinG: Double?
    let carbsG: Double?
    let fatG: Double?
    let fiberG: Double?
}

struct USDAFoodSummary: Codable, Identifiable, Hashable {
    var id: Int { fdcId }
    let fdcId: Int
    let name: String
    let brand: String?
    let servingSize: Double?
    let servingUnit: String?
    let calories: Double?
    let proteinG: Double?
    let carbsG: Double?
    let fatG: Double?
    let fiberG: Double?
}

struct DashboardSummary: Codable {
    let todayCalories: Double
    let todayProteinG: Double
    let latestWeightLbs: Double?
    let latestWeightDate: Date?
    let recentWorkouts: [RecentWorkout]
}

struct RecentWorkout: Codable, Identifiable, Hashable {
    let id: UUID
    let name: String?
    let startedAt: Date
    let durationMinutes: Int?
    let exerciseCount: Int
}
