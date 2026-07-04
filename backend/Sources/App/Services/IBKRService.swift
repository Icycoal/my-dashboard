import Vapor

/// Thin wrapper around the IBKR Client Portal Gateway REST API.
///
/// Requires the gateway to be running locally and authenticated.
/// Set IBKR_GATEWAY_URL in the environment (default: http://localhost:5000).
///
/// Gateway setup:
///   1. Download from https://www.interactivebrokers.com/en/trading/ib-api.php
///   2. In root/conf.yaml set  listenSsl: false  (avoids self-signed cert issues)
///   3. sh bin/run.sh root/conf.yaml
///   4. Open http://localhost:5000 and log in
struct IBKRService {
    let client: Client
    let logger: Logger

    private let base: String

    init(client: Client, logger: Logger) {
        self.client = client
        self.logger = logger
        self.base = Environment.get("IBKR_GATEWAY_URL") ?? "http://localhost:5055"
    }

    // MARK: - Internal response types

    struct AuthStatus: Content {
        let authenticated: Bool?
    }

    struct AccountInfo: Content {
        let id: String
    }

    struct SummaryField: Content {
        let amount: Double?
        let currency: String?
    }

    struct SummaryResponse: Content {
        let netliquidation: SummaryField?
        let totalcashvalue: SummaryField?
        let buyingpower: SummaryField?
        let grosspositionvalue: SummaryField?
        let unrealizedpnl: SummaryField?
        let realizedpnl: SummaryField?
    }

    struct PositionResponse: Content {
        let conid: Int?
        let contractDesc: String?
        let assetClass: String?
        let position: Double?
        let mktPrice: Double?
        let mktValue: Double?
        let avgCost: Double?
        let unrealizedPnl: Double?
        let realizedPnl: Double?
        let currency: String?
    }

    struct TradeResponse: Content {
        let execution_id: String?
        let symbol: String?
        let side: String?
        let size: String?
        let price: String?
        let commission: String?
        let trade_time_r: Int?
        let account: String?
        let company_name: String?
    }

    struct PnLAccountData: Content {
        let dpl: Double?
        let upl: Double?
        let nl: Double?
    }

    struct PnLResponse: Content {
        let upnl: [String: PnLAccountData]?
    }

    // MARK: - API methods

    // Must be called once per session after login before any portfolio/iserver endpoints.
    // Skipping this causes 403s on all subsequent calls.
    func initSession() async throws {
        _ = try? await client.get(URI(string: "\(base)/v1/api/iserver/accounts"), headers: browserHeaders())
    }

    func isAuthenticated() async throws -> Bool {
        let resp = try await get("/v1/api/iserver/auth/status")
        let status = try resp.content.decode(AuthStatus.self)
        return status.authenticated == true
    }

    // A browser login only establishes the SSO/web session. Portfolio and
    // iserver endpoints require the *brokerage* session, which has to be
    // triggered explicitly with /iserver/reauthenticate.
    func reauthenticate() async throws {
        _ = try? await client.post(URI(string: "\(base)/v1/api/iserver/reauthenticate"), headers: browserHeaders())
    }

    // Ensures the brokerage session is authenticated. If it isn't (common right
    // after a fresh gateway login), triggers a reauth and polls auth/status for
    // up to ~10s. Throws if the session never comes up — e.g. the user has not
    // logged into the gateway at all.
    func ensureBrokerageSession() async throws {
        if try await isAuthenticated() { return }

        try await reauthenticate()

        for _ in 0..<6 {
            try await Task.sleep(nanoseconds: 1_700_000_000)
            if (try? await isAuthenticated()) == true { return }
        }

        throw Abort(.serviceUnavailable,
                    reason: "IBKR gateway not authenticated. Open \(base) and log in, then click Sync.")
    }

    func fetchAccounts() async throws -> [String] {
        let resp = try await get("/v1/api/portfolio/accounts")
        let accounts = try resp.content.decode([AccountInfo].self)
        return accounts.map(\.id)
    }

    func fetchSummary(accountId: String) async throws -> SummaryResponse {
        let resp = try await get("/v1/api/portfolio/\(accountId)/summary")
        return try resp.content.decode(SummaryResponse.self)
    }

    func fetchPositions(accountId: String) async throws -> [PositionResponse] {
        var all: [PositionResponse] = []
        var page = 0
        while true {
            let resp = try await get("/v1/api/portfolio/\(accountId)/positions/\(page)")
            let page_data = try resp.content.decode([PositionResponse].self)
            all.append(contentsOf: page_data)
            if page_data.count < 30 { break }
            page += 1
        }
        return all
    }

    func fetchTrades() async throws -> [TradeResponse] {
        let resp = try await get("/v1/api/iserver/account/trades")
        return (try? resp.content.decode([TradeResponse].self)) ?? []
    }

    func fetchPnL() async throws -> PnLResponse {
        _ = try? await client.post(URI(string: "\(base)/v1/api/tickle"), headers: browserHeaders())
        let resp = try await get("/v1/api/iserver/account/pnl/partitioned")
        return try resp.content.decode(PnLResponse.self)
    }

    // MARK: - Helpers

    // IBKR gateway checks User-Agent and blocks non-browser clients with 403.
    private func browserHeaders() -> HTTPHeaders {
        var h = HTTPHeaders()
        h.add(name: .userAgent, value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        h.add(name: .accept, value: "application/json")
        return h
    }

    private func get(_ path: String) async throws -> ClientResponse {
        let resp = try await client.get(URI(string: "\(base)\(path)"), headers: browserHeaders())
        guard resp.status == .ok else {
            let body = resp.body.flatMap { String(buffer: $0) } ?? ""
            logger.warning("IBKR gateway error \(resp.status) at \(path): \(body)")
            throw Abort(.badGateway, reason: "IBKR gateway: \(resp.status)")
        }
        return resp
    }
}
