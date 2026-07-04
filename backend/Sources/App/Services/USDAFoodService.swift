import Vapor

/// Wraps the USDA FoodData Central API.
/// Get a free API key at https://fdc.nal.usda.gov/api-key-signup.html
/// Set the key in env var USDA_API_KEY. Falls back to "DEMO_KEY" (rate-limited) for dev.
struct USDAFoodService {
    let client: Client
    let apiKey: String
    let logger: Logger

    static let baseURL = "https://api.nal.usda.gov/fdc/v1"

    init(client: Client, logger: Logger, apiKey: String? = nil) {
        self.client = client
        self.logger = logger
        self.apiKey = apiKey ?? Environment.get("USDA_API_KEY") ?? "DEMO_KEY"
    }

    // MARK: - Response types

    struct SearchResult: Content {
        let foods: [FoodHit]
        let totalHits: Int?
    }

    struct FoodHit: Content {
        let fdcId: Int
        let description: String
        let brandOwner: String?
        let foodNutrients: [Nutrient]?
        let servingSize: Double?
        let servingSizeUnit: String?
    }

    struct Nutrient: Content {
        let nutrientId: Int?
        let nutrientName: String?
        let unitName: String?
        let value: Double?
    }

    // Nutrient IDs per USDA schema
    // 1008 = Energy (kcal), 1003 = Protein (g), 1005 = Carbs (g), 1004 = Total fat (g), 1079 = Fiber (g)

    // MARK: - API

    func search(query: String, pageSize: Int = 10) async throws -> SearchResult {
        var url = URI(string: "\(Self.baseURL)/foods/search")
        var comps = URLComponents(string: url.string) ?? URLComponents()
        comps.queryItems = [
            URLQueryItem(name: "query", value: query),
            URLQueryItem(name: "pageSize", value: String(pageSize)),
            URLQueryItem(name: "api_key", value: apiKey),
        ]
        if let built = comps.string {
            url = URI(string: built)
        }
        let response = try await client.get(url)
        guard response.status == .ok else {
            logger.warning("USDA search failed: \(response.status)")
            throw Abort(.badGateway, reason: "USDA API request failed")
        }
        return try response.content.decode(SearchResult.self)
    }

    /// Simplified per-item summary suitable for clients.
    struct FoodSummary: Content {
        let fdcId: Int
        let name: String
        let brand: String?
        let servingSize: Double?
        let servingUnit: String?
        let calories: Double?
        let proteinG: Double?
        let carbsG: Double?
        let fatG: Double?
        let fiberG: Double?
    }

    static func summarize(_ hit: FoodHit) -> FoodSummary {
        let nutrients = hit.foodNutrients ?? []
        func value(forId id: Int) -> Double? {
            nutrients.first(where: { $0.nutrientId == id })?.value
        }
        return FoodSummary(
            fdcId: hit.fdcId,
            name: hit.description,
            brand: hit.brandOwner,
            servingSize: hit.servingSize,
            servingUnit: hit.servingSizeUnit,
            calories: value(forId: 1008),
            proteinG: value(forId: 1003),
            carbsG: value(forId: 1005),
            fatG: value(forId: 1004),
            fiberG: value(forId: 1079)
        )
    }
}
