import Vapor
import Fluent

struct WeightController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let weight = routes.grouped("weight")
        weight.get(use: list)
        weight.post(use: create)
        weight.delete(":id", use: delete)
        weight.get("trend", use: trend)
    }

    struct CreateDTO: Content {
        let weightLbs: Double
        let loggedAt: Date?
    }

    struct TrendPoint: Content {
        let date: Date
        let weightLbs: Double
    }

    @Sendable
    func list(req: Request) async throws -> [WeightEntry] {
        let user = try req.auth.require(User.self)
        let from = (try? req.query.get(Date.self, at: "from"))
        let to = (try? req.query.get(Date.self, at: "to"))
        let limit = (try? req.query.get(Int.self, at: "limit")) ?? 100

        let userId = try user.requireID()
        var query = WeightEntry.query(on: req.db)
            .filter(\.$user.$id == userId)
            .sort(\.$loggedAt, .descending)
            .limit(limit)
        if let from { query = query.filter(\.$loggedAt >= from) }
        if let to { query = query.filter(\.$loggedAt <= to) }
        return try await query.all()
    }

    @Sendable
    func create(req: Request) async throws -> WeightEntry {
        let user = try req.auth.require(User.self)
        let dto = try req.content.decode(CreateDTO.self)
        let entry = WeightEntry(
            userId: try user.requireID(),
            weightLbs: dto.weightLbs,
            loggedAt: dto.loggedAt ?? Date()
        )
        try await entry.save(on: req.db)
        return entry
    }

    @Sendable
    func delete(req: Request) async throws -> HTTPStatus {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()
        guard let id = req.parameters.get("id", as: UUID.self),
              let entry = try await WeightEntry.query(on: req.db)
                .filter(\.$id == id)
                .filter(\.$user.$id == userId)
                .first() else {
            throw Abort(.notFound)
        }
        try await entry.delete(on: req.db)
        return .noContent
    }

    @Sendable
    func trend(req: Request) async throws -> [TrendPoint] {
        let user = try req.auth.require(User.self)
        let days = (try? req.query.get(Int.self, at: "days")) ?? 30
        let since = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        let userId = try user.requireID()
        let entries = try await WeightEntry.query(on: req.db)
            .filter(\.$user.$id == userId)
            .filter(\.$loggedAt >= since)
            .sort(\.$loggedAt, .ascending)
            .all()
        return entries.map { TrendPoint(date: $0.loggedAt, weightLbs: $0.weightLbs) }
    }
}
