import Vapor
import Fluent

struct DashboardController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let dash = routes.grouped("dashboard")
        dash.get("summary", use: summary)
    }

    struct Summary: Content {
        let todayCalories: Double
        let todayProteinG: Double
        let latestWeightLbs: Double?
        let latestWeightDate: Date?
        let recentWorkouts: [RecentWorkout]
    }

    struct RecentWorkout: Content {
        let id: UUID
        let name: String?
        let startedAt: Date
        let durationMinutes: Int?
        let exerciseCount: Int
    }

    @Sendable
    func summary(req: Request) async throws -> Summary {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()

        // Today = start of day in user's local timezone
        let tz = TimeZone(identifier: user.timezone) ?? .current
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        let startOfDay = cal.startOfDay(for: Date())

        // Today's food
        let todayLogs = try await FoodLog.query(on: req.db)
            .filter(\.$user.$id == userId)
            .filter(\.$loggedAt >= startOfDay)
            .with(\.$items)
            .all()
        let items = todayLogs.flatMap { $0.items }
        let totalCalories = items.compactMap { $0.calories }.reduce(0, +)
        let totalProtein = items.compactMap { $0.proteinG }.reduce(0, +)

        // Latest weight
        let latestWeight = try await WeightEntry.query(on: req.db)
            .filter(\.$user.$id == userId)
            .sort(\.$loggedAt, .descending)
            .first()

        // Recent workouts (last 5)
        let workouts = try await Workout.query(on: req.db)
            .filter(\.$user.$id == userId)
            .sort(\.$startedAt, .descending)
            .with(\.$exercises)
            .limit(5)
            .all()
        let recent = workouts.map {
            RecentWorkout(
                id: $0.id!,
                name: $0.name,
                startedAt: $0.startedAt,
                durationMinutes: $0.durationMinutes,
                exerciseCount: $0.exercises.count
            )
        }

        return Summary(
            todayCalories: totalCalories,
            todayProteinG: totalProtein,
            latestWeightLbs: latestWeight?.weightLbs,
            latestWeightDate: latestWeight?.loggedAt,
            recentWorkouts: recent
        )
    }
}
