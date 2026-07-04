import Vapor

struct QuotesController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        routes.get("quotes", use: fetch)
    }

    struct QuoteDTO: Content {
        let price: Double
        let change: Double
        let changePercent: Double
    }

    @Sendable
    func fetch(req: Request) async throws -> [String: QuoteDTO] {
        guard let raw = req.query[String.self, at: "symbols"] else {
            throw Abort(.badRequest, reason: "symbols query param is required")
        }
        let symbols = raw
            .split(separator: ",")
            .map { String($0).trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        if symbols.isEmpty { return [:] }

        var out: [String: QuoteDTO] = [:]
        for symbol in symbols {
            if let q = try? await fetchOne(symbol: symbol, client: req.client, logger: req.logger) {
                out[symbol] = q
            }
        }
        return out
    }

    private func fetchOne(symbol: String, client: Client, logger: Logger) async throws -> QuoteDTO? {
        let escaped = symbol.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? symbol
        let url = URI(string: "https://query1.finance.yahoo.com/v8/finance/chart/\(escaped)")

        var headers = HTTPHeaders()
        headers.add(name: .userAgent, value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        headers.add(name: .accept, value: "application/json")

        let res = try await client.get(url, headers: headers)
        guard res.status == .ok else {
            logger.warning("Yahoo returned \(res.status) for \(symbol)")
            return nil
        }

        let decoded = try res.content.decode(ChartResponse.self)
        guard let meta = decoded.chart.result?.first?.meta,
              let price = meta.regularMarketPrice else { return nil }
        let prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price
        let change = price - prevClose
        let changePercent = prevClose == 0 ? 0 : (change / prevClose) * 100
        return QuoteDTO(price: price, change: change, changePercent: changePercent)
    }

    struct ChartResponse: Content {
        let chart: Chart
        struct Chart: Content {
            let result: [ChartResult]?
        }
        struct ChartResult: Content {
            let meta: ChartMeta
        }
        struct ChartMeta: Content {
            let regularMarketPrice: Double?
            let chartPreviousClose: Double?
            let previousClose: Double?
        }
    }
}
