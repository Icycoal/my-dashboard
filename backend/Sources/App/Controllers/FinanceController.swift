import Vapor
import Fluent

struct FinanceController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let finances = routes.grouped("finances")
        finances.get("data", use: fetch)
        finances.post("data", use: save)
    }

    @Sendable
    func fetch(req: Request) async throws -> Response {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()

        let record = try await FinanceStateRecord.query(on: req.db)
            .filter(\.$user.$id == userId)
            .first()

        let body: String = record?.data ?? "{}"
        let resp = Response(status: .ok, body: .init(string: body))
        resp.headers.contentType = .json
        return resp
    }

    @Sendable
    func save(req: Request) async throws -> HTTPStatus {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()

        // Store the raw JSON body as-is so the shape stays fully client-owned.
        let buffer = try await req.body.collect(max: 10_000_000).get()
        guard let buf = buffer, let raw = buf.getString(at: 0, length: buf.readableBytes) else {
            throw Abort(.badRequest, reason: "empty body")
        }

        if let existing = try await FinanceStateRecord.query(on: req.db)
            .filter(\.$user.$id == userId)
            .first() {
            existing.data = raw
            try await existing.save(on: req.db)
        } else {
            let record = FinanceStateRecord(userId: userId, data: raw)
            try await record.save(on: req.db)
        }

        return .noContent
    }
}
