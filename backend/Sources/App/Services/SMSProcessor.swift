import Vapor
import Fluent

/// Processes an inbound SMS payload: classifies, writes to DB, and returns
/// a confirmation body (caller decides how to deliver it — inline TwiML or outbound SMS).
struct SMSProcessor {
    let db: Database
    let client: Client
    let logger: Logger

    /// Result of processing. The `reply` should be sent back to the user.
    struct Result {
        let parsedType: String
        let reply: String
    }

    func process(_ payload: SMSInboundPayload) async throws -> Result {
        // Look up user by phone
        let user = try await User.query(on: db)
            .filter(\.$phoneNumber == payload.from)
            .first()

        // Store raw message
        let record = SMSMessage(
            userId: try? user?.requireID(),
            fromNumber: payload.from, toNumber: payload.to,
            body: payload.body, direction: "inbound", twilioSid: payload.twilioSid
        )
        try await record.save(on: db)

        guard let user else {
            record.parsedType = "no_user"
            record.processedAt = Date()
            try await record.save(on: db)
            return Result(parsedType: "no_user",
                          reply: "Sorry, I don't recognize this number. Register an account first.")
        }

        let userId = try user.requireID()
        let message = SMSParserService.classify(payload.body)

        let result: Result
        switch message {
        case .weight(let lbs):
            let entry = WeightEntry(userId: userId, weightLbs: lbs, loggedAt: Date(), source: "sms")
            try await entry.save(on: db)
            result = Result(parsedType: "weight",
                            reply: "Logged weight: \(String(format: "%.1f", lbs)) lbs")

        case .food(let desc, let mealType):
            let meal = mealType ?? SMSParserService.MealType.infer(from: hour(for: user))
            let service = USDAFoodService(client: client, logger: logger)
            let searchTerm = desc.split(separator: ",").first.map(String.init) ?? desc

            let log = FoodLog(userId: userId, mealType: meal.rawValue,
                              loggedAt: Date(), notes: payload.body, source: "sms")
            try await log.save(on: db)
            let logId = try log.requireID()

            var itemName = desc
            var calories: Double?
            if let results = try? await service.search(query: searchTerm, pageSize: 1),
               let top = results.foods.first {
                let summary = USDAFoodService.summarize(top)
                let item = FoodItem(foodLogId: logId, name: summary.name, calories: summary.calories)
                item.usdaFdcId = summary.fdcId
                item.servingSize = summary.servingSize
                item.servingUnit = summary.servingUnit
                item.proteinG = summary.proteinG
                item.carbsG = summary.carbsG
                item.fatG = summary.fatG
                item.fiberG = summary.fiberG
                item.rawDescription = desc
                try await item.save(on: db)
                itemName = summary.name
                calories = summary.calories
            } else {
                let item = FoodItem(foodLogId: logId, name: desc)
                item.rawDescription = desc
                try await item.save(on: db)
            }

            let reply: String
            if let c = calories {
                reply = "Logged \(meal.rawValue): \(itemName) (\(Int(c)) cal)"
            } else {
                reply = "Logged \(meal.rawValue): \(itemName)"
            }
            result = Result(parsedType: "food", reply: reply)

        case .workout(let desc, let minutes, let miles, let name):
            let workout = Workout(userId: userId,
                                   name: name?.capitalized ?? "Workout",
                                   startedAt: Date(),
                                   durationMinutes: minutes,
                                   notes: desc, source: "sms")
            try await workout.save(on: db)
            if let name, let workoutId = workout.id {
                let type = isCardio(name) ? "cardio" : "strength"
                let exercise = Exercise(workoutId: workoutId, name: name.capitalized,
                                        exerciseType: type)
                try await exercise.save(on: db)
                if let exerciseId = exercise.id, minutes != nil || miles != nil {
                    let set = ExerciseSet(
                        exerciseId: exerciseId, setNumber: 1,
                        durationSeconds: minutes.map { $0 * 60 }, distanceMiles: miles)
                    try await set.save(on: db)
                }
            }
            var parts = [String]()
            if let name { parts.append(name) }
            if let minutes { parts.append("\(minutes) min") }
            if let miles { parts.append(String(format: "%.1f mi", miles)) }
            result = Result(parsedType: "workout",
                            reply: "Logged workout: \(parts.joined(separator: ", "))")

        case .unknown:
            result = Result(parsedType: "unknown",
                            reply: "Sorry, I didn't understand. Try:\n• '185' for weight\n• 'had chicken for lunch' for food\n• 'ran 3 miles' for workout")
        }

        record.parsedType = result.parsedType
        record.processedAt = Date()
        try await record.save(on: db)
        return result
    }

    // MARK: - Helpers

    private func hour(for user: User) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: user.timezone) ?? .current
        return cal.component(.hour, from: Date())
    }

    private func isCardio(_ name: String) -> Bool {
        let cardioKeywords = ["ran", "run", "walk", "swim", "bike", "cycle", "hike", "cardio", "row"]
        return cardioKeywords.contains(where: { name.contains($0) })
    }
}
