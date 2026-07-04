import Foundation

/// Base URLs for the two backends. For simulator, 127.0.0.1 works. On a
/// physical device, replace with your Mac's LAN IP (e.g., http://192.168.1.42).
enum APIConfig {
    static let healthBaseURL = URL(string: "http://127.0.0.1:8080/api/v1")!
    static let financesBaseURL = URL(string: "http://127.0.0.1:3001/api")!
    /// Legacy alias — still used by existing health code that hasn't been migrated.
    static var baseURL: URL { healthBaseURL }
}

enum APIError: Error, LocalizedError {
    case httpStatus(Int, String)
    case decode(Error)
    case transport(Error)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .httpStatus(let code, let body): return "HTTP \(code): \(body)"
        case .decode(let e): return "Decode error: \(e.localizedDescription)"
        case .transport(let e): return "Network: \(e.localizedDescription)"
        case .unauthorized: return "Not logged in"
        }
    }
}

@MainActor
final class APIClient: ObservableObject {
    static let shared = APIClient()

    @Published var token: String? {
        didSet { UserDefaults.standard.set(token, forKey: "ht.token") }
    }
    @Published var userId: UUID?
    @Published var userName: String?

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 15
        self.session = URLSession(configuration: cfg)

        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        self.decoder = d

        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        self.encoder = e

        self.token = UserDefaults.standard.string(forKey: "ht.token")
    }

    var isAuthenticated: Bool { token != nil }

    func logout() {
        token = nil
        userId = nil
        userName = nil
    }

    // MARK: - Request

    func request<T: Decodable>(
        _ path: String,
        baseURL: URL = APIConfig.healthBaseURL,
        method: String = "GET",
        body: Encodable? = nil,
        query: [URLQueryItem] = []
    ) async throws -> T {
        var comps = URLComponents(url: baseURL.appendingPathComponent(path),
                                   resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            req.httpBody = try encoder.encode(AnyEncodable(body))
        }

        do {
            let (data, response) = try await session.data(for: req)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.transport(URLError(.badServerResponse))
            }
            if http.statusCode == 401 {
                logout()
                throw APIError.unauthorized
            }
            guard (200...299).contains(http.statusCode) else {
                let body = String(data: data, encoding: .utf8) ?? ""
                throw APIError.httpStatus(http.statusCode, body)
            }
            if T.self == EmptyResponse.self {
                return EmptyResponse() as! T
            }
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decode(error)
            }
        } catch let err as APIError {
            throw err
        } catch {
            throw APIError.transport(error)
        }
    }

    // MARK: - Auth

    struct RegisterBody: Encodable {
        let name: String; let email: String; let password: String
        let phoneNumber: String?; let timezone: String?
    }
    struct LoginBody: Encodable { let email: String; let password: String }
    struct PasswordBody: Encodable { let password: String }

    func register(name: String, email: String, password: String, phone: String?) async throws {
        let resp: TokenResponse = try await request(
            "auth/register", method: "POST",
            body: RegisterBody(name: name, email: email, password: password,
                               phoneNumber: phone, timezone: TimeZone.current.identifier))
        apply(resp)
    }

    func login(email: String, password: String) async throws {
        let resp: TokenResponse = try await request(
            "auth/login", method: "POST",
            body: LoginBody(email: email, password: password))
        apply(resp)
    }

    func passwordLogin(password: String) async throws {
        let resp: TokenResponse = try await request(
            "auth/password", method: "POST",
            body: PasswordBody(password: password))
        apply(resp)
    }

    private func apply(_ resp: TokenResponse) {
        self.token = resp.token
        self.userId = resp.userId
        self.userName = resp.name
    }

    // MARK: - Weight

    struct CreateWeight: Encodable { let weightLbs: Double; let loggedAt: Date? }

    func listWeights() async throws -> [WeightEntry] {
        try await request("weight")
    }
    func createWeight(lbs: Double, at: Date? = nil) async throws -> WeightEntry {
        try await request("weight", method: "POST", body: CreateWeight(weightLbs: lbs, loggedAt: at))
    }
    func weightTrend(days: Int = 30) async throws -> [TrendPoint] {
        try await request("weight/trend", query: [URLQueryItem(name: "days", value: "\(days)")])
    }
    func deleteWeight(id: UUID) async throws {
        let _: EmptyResponse = try await request("weight/\(id)", method: "DELETE")
    }

    // MARK: - Workouts

    struct CreateWorkout: Encodable {
        let name: String?
        let startedAt: Date?
        let endedAt: Date?
        let durationMinutes: Int?
        let notes: String?
        let exercises: [NewExercise]?
    }
    struct NewExercise: Encodable {
        let name: String
        let exerciseType: String
        let sortOrder: Int?
        let sets: [NewSet]?
    }
    struct NewSet: Encodable {
        let setNumber: Int?
        let reps: Int?
        let weightLbs: Double?
        let durationSeconds: Int?
        let distanceMiles: Double?
    }

    func listWorkouts() async throws -> [Workout] { try await request("workouts") }
    func createWorkout(_ body: CreateWorkout) async throws -> Workout {
        try await request("workouts", method: "POST", body: body)
    }
    func deleteWorkout(id: UUID) async throws {
        let _: EmptyResponse = try await request("workouts/\(id)", method: "DELETE")
    }

    // MARK: - Food

    struct CreateFoodLog: Encodable {
        let mealType: String?
        let loggedAt: Date?
        let notes: String?
        let items: [NewFoodItem]
    }
    struct NewFoodItem: Encodable {
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

    func searchFood(query: String) async throws -> [USDAFoodSummary] {
        try await request("food/search", query: [URLQueryItem(name: "query", value: query)])
    }
    func listFoodLogs() async throws -> [FoodLog] { try await request("food/logs") }
    func createFoodLog(_ body: CreateFoodLog) async throws -> FoodLog {
        try await request("food/logs", method: "POST", body: body)
    }
    func deleteFoodLog(id: UUID) async throws {
        let _: EmptyResponse = try await request("food/logs/\(id)", method: "DELETE")
    }

    // MARK: - Dashboard

    func dashboardSummary() async throws -> DashboardSummary {
        try await request("dashboard/summary")
    }
}

struct EmptyResponse: Decodable {}

// Type-erasing helper so we can pass arbitrary Encodable values
struct AnyEncodable: Encodable {
    let value: Encodable
    init(_ value: Encodable) { self.value = value }
    func encode(to encoder: Encoder) throws { try value.encode(to: encoder) }
}
