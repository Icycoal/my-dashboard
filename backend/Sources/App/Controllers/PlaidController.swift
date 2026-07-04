import Vapor
import Fluent

struct PlaidController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let plaid = routes.grouped("plaid")
        plaid.post("create-link-token",  use: createLinkToken)
        plaid.post("exchange-token",     use: exchangeToken)
        plaid.get("accounts",            use: listAccounts)
        plaid.post("sync",               use: sync)
        plaid.delete("account", ":id",   use: removeAccount)
    }

    // MARK: - POST /plaid/create-link-token

    @Sendable
    func createLinkToken(req: Request) async throws -> Response {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID().uuidString
        let plaid = PlaidService(client: req.client, logger: req.logger)
        let token = try await plaid.createLinkToken(userId: userId)
        let body = try JSONEncoder().encode(["link_token": token])
        return Response(status: .ok,
                        headers: ["Content-Type": "application/json"],
                        body: .init(data: body))
    }

    // MARK: - POST /plaid/exchange-token

    struct ExchangeDTO: Content {
        let public_token: String
        let institution_id: String
        let institution_name: String
        let accounts: [LinkedAccountDTO]

        struct LinkedAccountDTO: Content {
            let id: String
            let name: String
            let type: String
            let subtype: String?
            let mask: String?
        }
    }

    @Sendable
    func exchangeToken(req: Request) async throws -> PlaidAccountResponse {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()
        let dto = try req.content.decode(ExchangeDTO.self)

        let plaid = PlaidService(client: req.client, logger: req.logger)
        let exchanged = try await plaid.exchangePublicToken(dto.public_token)

        // Encode sub-accounts as JSON for storage
        let linkedAccounts = dto.accounts.map {
            PlaidAccountResponse.LinkedAccount(
                id: $0.id, name: $0.name, type: $0.type,
                subtype: $0.subtype, mask: $0.mask)
        }
        let accountsJson = try String(data: JSONEncoder().encode(linkedAccounts), encoding: .utf8) ?? "[]"

        let item = PlaidItem(
            userId: userId,
            accessToken: exchanged.access_token,
            itemId: exchanged.item_id,
            institutionId: dto.institution_id,
            institutionName: dto.institution_name,
            accountsJson: accountsJson
        )
        try await item.save(on: req.db)

        return PlaidAccountResponse(
            id: try item.requireID().uuidString,
            institutionId: item.institutionId,
            institutionName: item.institutionName,
            accounts: linkedAccounts,
            lastSynced: nil
        )
    }

    // MARK: - GET /plaid/accounts

    @Sendable
    func listAccounts(req: Request) async throws -> [PlaidAccountResponse] {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()
        let items = try await PlaidItem.query(on: req.db)
            .filter(\.$user.$id == userId)
            .all()
        return try items.map { try itemToResponse($0) }
    }

    // MARK: - POST /plaid/sync

    struct SyncResponse: Content {
        let transactions: [TransactionDTO]
        let syncedAt: String
        let cashBalance: Double?

        struct TransactionDTO: Content {
            let id: String
            let plaidTransactionId: String
            let plaidAccountId: String
            let amount: Double
            let year: Int; let month: Int; let day: Int
            let description: String
            let category: String
        }
    }

    @Sendable
    func sync(req: Request) async throws -> SyncResponse {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()
        let items = try await PlaidItem.query(on: req.db)
            .filter(\.$user.$id == userId)
            .all()

        let plaid = PlaidService(client: req.client, logger: req.logger)
        var allTxns: [SyncResponse.TransactionDTO] = []
        var totalCashBalance: Double = 0

        for item in items {
            var cursor = item.syncCursor
            var hasMore = true
            while hasMore {
                let result = try await plaid.syncTransactions(
                    accessToken: item.accessToken, cursor: cursor)
                cursor = result.next_cursor
                hasMore = result.has_more

                for tx in result.added where !(tx.pending ?? false) {
                    guard let parts = parseDate(tx.date) else { continue }
                    let category = tx.category?.first ?? "Uncategorized"
                    // Plaid: positive amount = money leaving account (expense)
                    let signedAmount = -tx.amount
                    allTxns.append(SyncResponse.TransactionDTO(
                        id: UUID().uuidString,
                        plaidTransactionId: tx.transaction_id,
                        plaidAccountId: tx.account_id,
                        amount: signedAmount,
                        year: parts.year, month: parts.month, day: parts.day,
                        description: tx.name,
                        category: category
                    ))
                }
            }
            item.syncCursor = cursor
            item.lastSyncedAt = Date()
            try await item.save(on: req.db)

            // Sum balances of all depository accounts (checking + savings)
            if let balanceResp = try? await plaid.fetchBalances(accessToken: item.accessToken) {
                for acct in balanceResp.accounts where acct.type == "depository" {
                    totalCashBalance += acct.balances.available ?? acct.balances.current ?? 0
                }
            }
        }

        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        return SyncResponse(
            transactions: allTxns,
            syncedAt: iso.string(from: Date()),
            cashBalance: items.isEmpty ? nil : totalCashBalance
        )
    }

    // MARK: - DELETE /plaid/account/:id

    @Sendable
    func removeAccount(req: Request) async throws -> HTTPStatus {
        let user = try req.auth.require(User.self)
        let userId = try user.requireID()
        guard let id = req.parameters.get("id", as: UUID.self),
              let item = try await PlaidItem.query(on: req.db)
                .filter(\.$id == id)
                .filter(\.$user.$id == userId)
                .first() else {
            throw Abort(.notFound)
        }
        try await item.delete(on: req.db)
        return .noContent
    }

    // MARK: - Helpers

    private func itemToResponse(_ item: PlaidItem) throws -> PlaidAccountResponse {
        let accounts = (try? JSONDecoder().decode(
            [PlaidAccountResponse.LinkedAccount].self,
            from: Data(item.accountsJson.utf8))) ?? []

        var lastSynced: String? = nil
        if let d = item.lastSyncedAt {
            let fmt = ISO8601DateFormatter()
            fmt.formatOptions = [.withInternetDateTime]
            lastSynced = fmt.string(from: d)
        }

        return PlaidAccountResponse(
            id: try item.requireID().uuidString,
            institutionId: item.institutionId,
            institutionName: item.institutionName,
            accounts: accounts,
            lastSynced: lastSynced
        )
    }

    private func parseDate(_ s: String) -> (year: Int, month: Int, day: Int)? {
        let parts = s.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return (parts[0], parts[1], parts[2])
    }
}
