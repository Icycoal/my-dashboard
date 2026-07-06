import Vapor
import Fluent
import Foundation

struct FinanceController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let finances = routes.grouped("finances")
        finances.get("data", use: fetch)
        finances.post("data", use: save)
        finances.post("transactions", "sync", use: syncTransactions)
    }

    // MARK: - GET /finances/data
    //
    // Returns the full state: the stored blob with transactions (kept as rows)
    // merged back in, so clients see the same shape as before the split.

    @Sendable
    func fetch(req: Request) async throws -> Response {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()

        let record = try await FinanceStateRecord.query(on: req.db)
            .filter(\.$user.$id == userId)
            .first()

        var state: [String: Any] = [:]
        if let record,
           let obj = try? JSONSerialization.jsonObject(with: Data(record.data.utf8)) as? [String: Any] {
            state = obj
        }

        // Lazy migration: blobs written before the split still carry transactions.
        if let legacy = state["transactions"] as? [[String: Any]] {
            try await replaceTransactions(legacy, userId: userId, on: req.db)
            state.removeValue(forKey: "transactions")
            if let record {
                record.data = jsonString(state)
                try await record.save(on: req.db)
            }
        }

        let rows = try await FinanceTransaction.query(on: req.db)
            .filter(\.$user.$id == userId)
            .sort(\.$year).sort(\.$month).sort(\.$day)
            .all()
        state["transactions"] = rows.compactMap {
            try? JSONSerialization.jsonObject(with: Data($0.data.utf8))
        }

        let resp = Response(status: .ok, body: .init(string: jsonString(state)))
        resp.headers.contentType = .json
        return resp
    }

    // MARK: - POST /finances/data
    //
    // The web client posts the state without a "transactions" key (rows are
    // synced separately). If the key is present (legacy client, importer),
    // it is treated as the authoritative full set and split out into rows.

    @Sendable
    func save(req: Request) async throws -> HTTPStatus {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()

        let buffer = try await req.body.collect(max: 10_000_000).get()
        guard let buf = buffer, let raw = buf.getString(at: 0, length: buf.readableBytes) else {
            throw Abort(.badRequest, reason: "empty body")
        }

        var toStore = raw
        if var dict = try? JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any],
           let txns = dict["transactions"] as? [[String: Any]] {
            try await replaceTransactions(txns, userId: userId, on: req.db)
            dict.removeValue(forKey: "transactions")
            toStore = jsonString(dict)
        }

        if let existing = try await FinanceStateRecord.query(on: req.db)
            .filter(\.$user.$id == userId)
            .first() {
            existing.data = toStore
            try await existing.save(on: req.db)
        } else {
            let record = FinanceStateRecord(userId: userId, data: toStore)
            try await record.save(on: req.db)
        }

        return .noContent
    }

    // MARK: - POST /finances/transactions/sync
    //
    // Body: { "upserts": [Transaction], "deletes": [clientId] }

    @Sendable
    func syncTransactions(req: Request) async throws -> HTTPStatus {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()

        let buffer = try await req.body.collect(max: 10_000_000).get()
        guard let buf = buffer,
              let bytes = buf.getData(at: 0, length: buf.readableBytes),
              let dict = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any] else {
            throw Abort(.badRequest, reason: "invalid body")
        }
        let upserts = dict["upserts"] as? [[String: Any]] ?? []
        let deletes = dict["deletes"] as? [String] ?? []

        try await req.db.transaction { db in
            for obj in upserts {
                try await self.upsertTransaction(obj, userId: userId, on: db)
            }
            if !deletes.isEmpty {
                try await FinanceTransaction.query(on: db)
                    .filter(\.$user.$id == userId)
                    .filter(\.$clientId ~~ deletes)
                    .delete()
            }
        }

        return .noContent
    }

    // MARK: - Helpers

    private func upsertTransaction(_ obj: [String: Any], userId: UUID, on db: Database) async throws {
        guard let clientId = obj["id"] as? String, !clientId.isEmpty else { return }
        let row = try await FinanceTransaction.query(on: db)
            .filter(\.$user.$id == userId)
            .filter(\.$clientId == clientId)
            .first() ?? FinanceTransaction(userId: userId, clientId: clientId)
        row.category = obj["category"] as? String ?? ""
        row.amount = (obj["amount"] as? NSNumber)?.doubleValue ?? 0
        row.year = (obj["year"] as? NSNumber)?.intValue ?? 0
        row.month = (obj["month"] as? NSNumber)?.intValue ?? 0
        row.day = (obj["day"] as? NSNumber)?.intValue ?? 0
        row.data = jsonString(obj)
        try await row.save(on: db)
    }

    /// Full-set replace: upserts every transaction in `txns` and deletes the
    /// user's rows that aren't in it.
    private func replaceTransactions(_ txns: [[String: Any]], userId: UUID, on db: Database) async throws {
        try await db.transaction { db in
            var keep = Set<String>()
            for obj in txns {
                if let id = obj["id"] as? String { keep.insert(id) }
                try await self.upsertTransaction(obj, userId: userId, on: db)
            }
            let existing = try await FinanceTransaction.query(on: db)
                .filter(\.$user.$id == userId)
                .all()
            for row in existing where !keep.contains(row.clientId) {
                try await row.delete(on: db)
            }
        }
    }

    private func jsonString(_ obj: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: obj) else { return "{}" }
        return String(decoding: data, as: UTF8.self)
    }
}
