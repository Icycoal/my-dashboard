import Foundation

/// Read-only v1 client for the finances Express backend. Shares the JWT with
/// APIClient (health). Writes are intentionally not exposed yet — Plaid Link
/// flows happen on the web.
extension APIClient {
    func loadFinancesState() async throws -> FinancesState {
        try await request("data", baseURL: APIConfig.financesBaseURL)
    }

    func loadPlaidAccounts() async throws -> [FinancesPlaidAccount] {
        try await request("plaid/accounts", baseURL: APIConfig.financesBaseURL)
    }
}
