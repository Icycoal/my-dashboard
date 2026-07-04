import Vapor
import Fluent

/// Checks every user for due reminders and sends SMS via Twilio.
/// Called periodically by the scheduler loop.
struct ReminderService {
    let app: Application

    // Hour-of-day (local tz) when each reminder fires
    static let weighInHour = 7
    static let breakfastHour = 9
    static let lunchHour = 13
    static let dinnerHour = 19

    /// Tick once — checks all users and sends any due reminders.
    func tick() async throws {
        let users = try await User.query(on: app.db)
            .filter(\.$smsRemindersEnabled == true)
            .filter(\.$phoneNumber != nil)
            .all()

        for user in users {
            do { try await checkReminders(for: user) }
            catch { app.logger.warning("Reminder failed for \(user.email): \(error)") }
        }
    }

    private func checkReminders(for user: User) async throws {
        guard let phone = user.phoneNumber else { return }

        let tz = TimeZone(identifier: user.timezone) ?? .current
        var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
        let now = Date()
        let hour = cal.component(.hour, from: now)
        let minute = cal.component(.minute, from: now)
        let startOfDay = cal.startOfDay(for: now)
        let userId = try user.requireID()

        // Only fire during the first minute of each reminder hour
        guard minute == 0 else { return }

        // Guard: don't re-send the same prompt within 8 hours
        if let last = user.lastPromptAt, now.timeIntervalSince(last) < 8 * 3600 {
            return
        }

        switch hour {
        case Self.weighInHour:
            let already = try await WeightEntry.query(on: app.db)
                .filter(\.$user.$id == userId)
                .filter(\.$loggedAt >= startOfDay)
                .count() > 0
            if !already {
                try await send(to: phone, body: "Good morning! Time to weigh in. Reply with your weight (e.g., 185.5)", user: user, promptType: "weigh_in")
            }

        case Self.breakfastHour, Self.lunchHour, Self.dinnerHour:
            let meal = mealFor(hour: hour)
            let already = try await FoodLog.query(on: app.db)
                .filter(\.$user.$id == userId)
                .filter(\.$loggedAt >= startOfDay)
                .filter(\.$mealType == meal)
                .count() > 0
            if !already {
                try await send(to: phone,
                               body: "What did you have for \(meal)? Just reply with the foods (e.g., '2 eggs and toast')",
                               user: user, promptType: "meal_\(meal)")
            }

        default:
            return
        }
    }

    private func mealFor(hour: Int) -> String {
        switch hour {
        case Self.breakfastHour: return "breakfast"
        case Self.lunchHour:     return "lunch"
        case Self.dinnerHour:    return "dinner"
        default:                 return "snack"
        }
    }

    private func send(to phone: String, body: String, user: User, promptType: String) async throws {
        let client = app.client
        let twilio = try TwilioService(client: client, logger: app.logger)
        try await twilio.send(to: phone, body: body)

        // Record the outbound message
        let record = SMSMessage(
            userId: try user.requireID(),
            fromNumber: twilio.fromNumber, toNumber: phone,
            body: body, direction: "outbound"
        )
        try await record.save(on: app.db)

        user.lastPromptType = promptType
        user.lastPromptAt = Date()
        try await user.save(on: app.db)

        app.logger.info("Sent \(promptType) reminder to \(user.email)")
    }
}

/// Long-running Task that calls ReminderService.tick() every minute.
/// Registered as a LifecycleHandler so it starts with the app and stops cleanly.
final class ReminderScheduler: LifecycleHandler, @unchecked Sendable {
    private var task: Task<Void, Never>?

    func didBoot(_ app: Application) throws {
        // Only run if Twilio is configured — otherwise the send() calls will error every minute
        guard Environment.get("TWILIO_ACCOUNT_SID") != nil,
              Environment.get("TWILIO_AUTH_TOKEN") != nil,
              Environment.get("TWILIO_FROM_NUMBER") != nil else {
            app.logger.info("ReminderScheduler disabled — Twilio env vars not set")
            return
        }

        let service = ReminderService(app: app)
        app.logger.info("ReminderScheduler starting (tick every 60s)")
        task = Task { [weak app] in
            while !Task.isCancelled {
                do { try await service.tick() }
                catch { app?.logger.warning("Reminder tick failed: \(error)") }
                try? await Task.sleep(nanoseconds: 60 * 1_000_000_000)
            }
        }
    }

    func shutdown(_ app: Application) {
        task?.cancel()
        task = nil
    }
}
