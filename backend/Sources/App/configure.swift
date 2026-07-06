import Vapor
import Fluent
import FluentSQLiteDriver
import JWT

public func configure(_ app: Application) async throws {
    // CORS — allow the Next.js dev server
    let corsConfig = CORSMiddleware.Configuration(
        allowedOrigin: .any(["http://localhost:3000"]),
        allowedMethods: [.GET, .POST, .PUT, .DELETE, .OPTIONS, .PATCH],
        allowedHeaders: [.accept, .authorization, .contentType, .origin]
    )
    app.middleware.use(CORSMiddleware(configuration: corsConfig), at: .beginning)

    // SQLite database (file-based at ./db.sqlite)
    app.databases.use(.sqlite(.file("db.sqlite")), as: .sqlite)

    // Allow larger JSON payloads (finance state can exceed the 16KB default)
    app.routes.defaultMaxBodySize = "10mb"

    // JWT signing key — set HEALTH_JWT_SECRET in environment, fallback dev key
    let jwtSecret = Environment.get("HEALTH_JWT_SECRET") ?? "dev-only-change-me"
    app.jwt.signers.use(.hs256(key: jwtSecret))

    // Migrations
    app.migrations.add(CreateUser())
    app.migrations.add(CreateWeightEntry())
    app.migrations.add(CreateWorkout())
    app.migrations.add(CreateExercise())
    app.migrations.add(CreateExerciseSet())
    app.migrations.add(CreateFoodLog())
    app.migrations.add(CreateFoodItem())
    app.migrations.add(CreateSMSMessage())
    app.migrations.add(CreateFinanceState())
    app.migrations.add(CreatePlaidItem())
    app.migrations.add(CreateFinanceTransaction())

    try await app.autoMigrate()

    // Message broker — in-memory by default. Store on app for controllers.
    let broker = InMemoryBroker(logger: app.logger)
    app.storage[MessageBrokerKey.self] = broker

    // SMS consumer subscribes to sms.inbound
    app.lifecycle.use(SMSConsumer(broker: broker))

    // Reminder scheduler (only runs if Twilio env vars are set)
    app.lifecycle.use(ReminderScheduler())

    // Routes
    try routes(app)
}

/// Storage key so controllers can get the broker off the app.
struct MessageBrokerKey: StorageKey {
    typealias Value = any MessageBroker
}

extension Application {
    var broker: any MessageBroker {
        guard let b = storage[MessageBrokerKey.self] else {
            fatalError("MessageBroker not configured")
        }
        return b
    }
}

extension Request {
    var broker: any MessageBroker { application.broker }
}
