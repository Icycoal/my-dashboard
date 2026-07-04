import Vapor
import Fluent

struct FoodController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let food = routes.grouped("food")
        food.get("search", use: search)
        food.get("logs", use: listLogs)
        food.post("logs", use: createLog)
        food.get("logs", ":id", use: getLog)
        food.put("logs", ":id", use: updateLog)
        food.delete("logs", ":id", use: deleteLog)
    }

    // MARK: - DTOs

    struct FoodItemDTO: Content {
        let name: String
        let usdaFdcId: Int?
        let servingSize: Double?
        let servingUnit: String?
        let calories: Double?
        let proteinG: Double?
        let carbsG: Double?
        let fatG: Double?
        let fiberG: Double?
        let rawDescription: String?
    }

    struct CreateLogDTO: Content {
        let mealType: String?
        let loggedAt: Date?
        let notes: String?
        let items: [FoodItemDTO]
    }

    struct UpdateLogDTO: Content {
        let mealType: String?
        let loggedAt: Date?
        let notes: String?
    }

    struct LogResponse: Content {
        let id: UUID
        let mealType: String?
        let loggedAt: Date
        let notes: String?
        let source: String
        let totalCalories: Double
        let items: [ItemResponse]
    }

    struct ItemResponse: Content {
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

    // MARK: - Search

    @Sendable
    func search(req: Request) async throws -> [USDAFoodService.FoodSummary] {
        _ = try req.auth.require(User.self)
        guard let query = try? req.query.get(String.self, at: "query"), !query.isEmpty else {
            throw Abort(.badRequest, reason: "Missing 'query' parameter")
        }
        let pageSize = (try? req.query.get(Int.self, at: "pageSize")) ?? 10
        let service = USDAFoodService(client: req.client, logger: req.logger)
        let result = try await service.search(query: query, pageSize: pageSize)
        return result.foods.map(USDAFoodService.summarize)
    }

    // MARK: - Logs

    @Sendable
    func listLogs(req: Request) async throws -> [LogResponse] {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()
        let from = (try? req.query.get(Date.self, at: "from"))
        let to = (try? req.query.get(Date.self, at: "to"))
        let limit = (try? req.query.get(Int.self, at: "limit")) ?? 100

        var q = FoodLog.query(on: req.db)
            .filter(\.$user.$id == userId)
            .sort(\.$loggedAt, .descending)
            .with(\.$items)
            .limit(limit)
        if let from { q = q.filter(\.$loggedAt >= from) }
        if let to { q = q.filter(\.$loggedAt <= to) }
        let logs = try await q.all()
        return logs.map(Self.toResponse)
    }

    @Sendable
    func getLog(req: Request) async throws -> LogResponse {
        let log = try await resolve(req: req, loadItems: true)
        return Self.toResponse(log)
    }

    @Sendable
    func createLog(req: Request) async throws -> LogResponse {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()
        let dto = try req.content.decode(CreateLogDTO.self)

        let log = FoodLog(
            userId: userId,
            mealType: dto.mealType,
            loggedAt: dto.loggedAt ?? Date(),
            notes: dto.notes
        )

        try await req.db.transaction { db in
            try await log.save(on: db)
            let logId = try log.requireID()
            for itemDTO in dto.items {
                let item = FoodItem(foodLogId: logId, name: itemDTO.name)
                item.usdaFdcId = itemDTO.usdaFdcId
                item.servingSize = itemDTO.servingSize
                item.servingUnit = itemDTO.servingUnit
                item.calories = itemDTO.calories
                item.proteinG = itemDTO.proteinG
                item.carbsG = itemDTO.carbsG
                item.fatG = itemDTO.fatG
                item.fiberG = itemDTO.fiberG
                item.rawDescription = itemDTO.rawDescription
                try await item.save(on: db)
            }
        }

        let loaded = try await FoodLog.query(on: req.db)
            .filter(\.$id == (try log.requireID()))
            .with(\.$items)
            .first()!
        return Self.toResponse(loaded)
    }

    @Sendable
    func updateLog(req: Request) async throws -> LogResponse {
        let log = try await resolve(req: req, loadItems: false)
        let dto = try req.content.decode(UpdateLogDTO.self)
        if let m = dto.mealType { log.mealType = m }
        if let l = dto.loggedAt { log.loggedAt = l }
        if let n = dto.notes { log.notes = n }
        try await log.save(on: req.db)
        let loaded = try await FoodLog.query(on: req.db)
            .filter(\.$id == (try log.requireID()))
            .with(\.$items)
            .first()!
        return Self.toResponse(loaded)
    }

    @Sendable
    func deleteLog(req: Request) async throws -> HTTPStatus {
        let log = try await resolve(req: req, loadItems: false)
        try await log.delete(on: req.db)
        return .noContent
    }

    // MARK: - Helpers

    private func resolve(req: Request, loadItems: Bool) async throws -> FoodLog {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()
        guard let id = req.parameters.get("id", as: UUID.self) else {
            throw Abort(.badRequest, reason: "Invalid log id")
        }
        var q = FoodLog.query(on: req.db)
            .filter(\.$id == id)
            .filter(\.$user.$id == userId)
        if loadItems { q = q.with(\.$items) }
        guard let log = try await q.first() else { throw Abort(.notFound) }
        return log
    }

    static func toResponse(_ log: FoodLog) -> LogResponse {
        let items = log.items.map { item in
            ItemResponse(
                id: item.id!,
                name: item.name,
                usdaFdcId: item.usdaFdcId,
                servingSize: item.servingSize,
                servingUnit: item.servingUnit,
                calories: item.calories,
                proteinG: item.proteinG,
                carbsG: item.carbsG,
                fatG: item.fatG,
                fiberG: item.fiberG
            )
        }
        let total = items.compactMap { $0.calories }.reduce(0, +)
        return LogResponse(
            id: log.id!,
            mealType: log.mealType,
            loggedAt: log.loggedAt,
            notes: log.notes,
            source: log.source,
            totalCalories: total,
            items: items
        )
    }
}
