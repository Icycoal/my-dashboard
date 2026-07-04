import Vapor
import Foundation

struct IBKRController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let ibkr = routes.grouped("ibkr")
        ibkr.get("status",          use: status)
        ibkr.get("portfolio",       use: portfolio)
        ibkr.post("gateway", "start", use: startGateway)
    }

    // MARK: - POST /ibkr/gateway/start

    @Sendable
    func startGateway(req: Request) async throws -> HTTPStatus {
        let gatewayPath = Environment.get("IBKR_GATEWAY_PATH")
            ?? NSHomeDirectory() + "/Downloads/clientportal.gw"

        let ibkr = IBKRService(client: req.client, logger: req.logger)
        if (try? await ibkr.isAuthenticated()) == true {
            return .ok  // already running and authenticated
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/sh")
        process.arguments = ["bin/run.sh", "root/conf.yaml"]
        process.currentDirectoryURL = URL(fileURLWithPath: gatewayPath)

        do {
            try process.run()  // non-blocking — gateway runs in background
        } catch {
            throw Abort(.internalServerError, reason: "Could not launch gateway at \(gatewayPath): \(error.localizedDescription)")
        }

        return .accepted
    }

    // MARK: - GET /ibkr/status

    struct StatusResponse: Content {
        let gatewayReachable: Bool
        let authenticated: Bool
        let gatewayURL: String
    }

    @Sendable
    func status(req: Request) async throws -> StatusResponse {
        let ibkr = IBKRService(client: req.client, logger: req.logger)
        let gatewayURL = Environment.get("IBKR_GATEWAY_URL") ?? "http://localhost:5055"
        do {
            let authed = try await ibkr.isAuthenticated()
            return StatusResponse(gatewayReachable: true, authenticated: authed, gatewayURL: gatewayURL)
        } catch {
            return StatusResponse(gatewayReachable: false, authenticated: false, gatewayURL: gatewayURL)
        }
    }

    // MARK: - GET /ibkr/portfolio

    struct PortfolioResponse: Content {
        struct AccountData: Content {
            let summary: IBKRService.SummaryResponse
            let positions: [IBKRService.PositionResponse]
        }
        struct PnLEntry: Content {
            let dailyPnl: Double?
            let unrealizedPnl: Double?
            let realizedPnl: Double?
        }
        let accounts: [String: AccountData]
        let trades: [IBKRService.TradeResponse]
        let pnl: [String: PnLEntry]
    }

    @Sendable
    func portfolio(req: Request) async throws -> PortfolioResponse {
        let ibkr = IBKRService(client: req.client, logger: req.logger)

        // Brings up the brokerage session (reauth + poll) if a fresh login only
        // left the SSO session established; throws if not logged in at all.
        try await ibkr.ensureBrokerageSession()

        try await ibkr.initSession()
        let accountIds = try await ibkr.fetchAccounts()
        var accounts: [String: PortfolioResponse.AccountData] = [:]

        for id in accountIds {
            async let summary   = ibkr.fetchSummary(accountId: id)
            async let positions = ibkr.fetchPositions(accountId: id)
            accounts[id] = try await .init(summary: summary, positions: positions)
        }

        let trades  = try await ibkr.fetchTrades()
        let pnlResp = try await ibkr.fetchPnL()

        let pnl = (pnlResp.upnl ?? [:]).mapValues {
            PortfolioResponse.PnLEntry(
                dailyPnl:      $0.dpl,
                unrealizedPnl: $0.upl,
                realizedPnl:   $0.nl
            )
        }

        return PortfolioResponse(accounts: accounts, trades: trades, pnl: pnl)
    }
}
