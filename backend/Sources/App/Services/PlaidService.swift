import Vapor

/// Thin wrapper around the Plaid REST API (production or sandbox).
/// Set PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV in the environment.
struct PlaidService {
    let client: Client
    let logger: Logger

    private let clientId: String
    private let secret: String
    private let baseURL: String

    init(client: Client, logger: Logger) {
        self.client = client
        self.logger = logger
        self.clientId = Environment.get("PLAID_CLIENT_ID") ?? ""
        self.secret   = Environment.get("PLAID_SECRET")    ?? ""
        let env       = Environment.get("PLAID_ENV")       ?? "production"
        self.baseURL  = env == "sandbox"
            ? "https://sandbox.plaid.com"
            : "https://production.plaid.com"
    }

    // MARK: - Response / request types (internal)

    struct LinkTokenRequest: Content {
        let client_id: String
        let secret: String
        let user: PlaidUser
        let client_name: String
        let products: [String]
        let country_codes: [String]
        let language: String

        struct PlaidUser: Content { let client_user_id: String }
    }

    struct LinkTokenResponse: Content {
        let link_token: String
        let expiration: String?
        let request_id: String?
    }

    struct ExchangeRequest: Content {
        let client_id: String
        let secret: String
        let public_token: String
    }

    struct ExchangeResponse: Content {
        let access_token: String
        let item_id: String
    }

    struct TransactionsSyncRequest: Content {
        let client_id: String
        let secret: String
        let access_token: String
        let cursor: String?
        let count: Int?
    }

    struct TransactionsSyncResponse: Content {
        let added: [PlaidTransaction]
        let modified: [PlaidTransaction]
        let removed: [RemovedTransaction]
        let next_cursor: String
        let has_more: Bool
    }

    struct PlaidTransaction: Content {
        let transaction_id: String
        let account_id: String
        let amount: Double          // positive = debit from account, negative = credit
        let date: String            // "YYYY-MM-DD"
        let name: String
        let category: [String]?
        let pending: Bool?
    }

    struct RemovedTransaction: Content {
        let transaction_id: String
    }

    // MARK: - Balance types

    struct BalanceRequest: Content {
        let client_id: String
        let secret: String
        let access_token: String
    }

    struct BalanceResponse: Content {
        let accounts: [PlaidBalanceAccount]
    }

    struct PlaidBalanceAccount: Content {
        let account_id: String
        let type: String       // "depository", "credit", "investment", etc.
        let subtype: String?   // "checking", "savings", etc.
        let balances: Balances

        struct Balances: Content {
            let current: Double?
            let available: Double?
        }
    }

    // MARK: - API methods

    /// Returns a Plaid link_token for the given user.
    func createLinkToken(userId: String) async throws -> String {
        let body = LinkTokenRequest(
            client_id: clientId,
            secret: secret,
            user: .init(client_user_id: userId),
            client_name: "Health & Finances",
            products: ["transactions"],
            country_codes: ["US"],
            language: "en"
        )
        let resp = try await client.post(URI(string: "\(baseURL)/link/token/create")) { req in
            try req.content.encode(body, as: .json)
        }
        try checkPlaidError(resp)
        let decoded = try resp.content.decode(LinkTokenResponse.self)
        return decoded.link_token
    }

    /// Exchanges a public token for an access token + item_id.
    func exchangePublicToken(_ publicToken: String) async throws -> ExchangeResponse {
        let body = ExchangeRequest(client_id: clientId, secret: secret, public_token: publicToken)
        let resp = try await client.post(URI(string: "\(baseURL)/item/public_token/exchange")) { req in
            try req.content.encode(body, as: .json)
        }
        try checkPlaidError(resp)
        return try resp.content.decode(ExchangeResponse.self)
    }

    /// Fetches new / modified / removed transactions using the sync cursor.
    func syncTransactions(accessToken: String, cursor: String?) async throws -> TransactionsSyncResponse {
        let body = TransactionsSyncRequest(
            client_id: clientId,
            secret: secret,
            access_token: accessToken,
            cursor: cursor,
            count: 500
        )
        let resp = try await client.post(URI(string: "\(baseURL)/transactions/sync")) { req in
            try req.content.encode(body, as: .json)
        }
        try checkPlaidError(resp)
        return try resp.content.decode(TransactionsSyncResponse.self)
    }

    /// Fetches real-time account balances for the given access token.
    func fetchBalances(accessToken: String) async throws -> BalanceResponse {
        let body = BalanceRequest(client_id: clientId, secret: secret, access_token: accessToken)
        let resp = try await client.post(URI(string: "\(baseURL)/accounts/balance/get")) { req in
            try req.content.encode(body, as: .json)
        }
        try checkPlaidError(resp)
        return try resp.content.decode(BalanceResponse.self)
    }

    // MARK: - Helpers

    private func checkPlaidError(_ resp: ClientResponse) throws {
        guard resp.status == .ok else {
            let body = resp.body.flatMap { String(buffer: $0) } ?? ""
            logger.warning("Plaid error \(resp.status): \(body)")
            throw Abort(.badGateway, reason: "Plaid API error: \(body)")
        }
    }
}
