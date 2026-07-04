import Vapor

func routes(_ app: Application) throws {
    app.get("health") { _ async in "ok" }

    let api = app.grouped("api", "v1")

    try api.register(collection: AuthController())

    // Twilio webhook — no JWT (validated via X-Twilio-Signature)
    try api.register(collection: TwilioWebhookController())

    // Protected routes — require valid JWT
    let protected = api.grouped(UserAuthenticator(), User.guardMiddleware())
    try protected.register(collection: WeightController())
    try protected.register(collection: WorkoutController())
    try protected.register(collection: FoodController())
    try protected.register(collection: DashboardController())
    try protected.register(collection: FinanceController())
    try protected.register(collection: PlaidController())
    try protected.register(collection: IBKRController())
    try protected.register(collection: QuotesController())
}
