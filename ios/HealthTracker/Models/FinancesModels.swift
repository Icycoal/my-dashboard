import Foundation

struct FinancesTransaction: Codable, Identifiable, Hashable {
    let id: String
    let category: String
    let amount: Double
    let year: Int
    let month: Int
    let day: Int
    let description: String?
    let plaidTransactionId: String?
    let plaidAccountId: String?

    var date: Date? {
        var c = DateComponents()
        c.year = year; c.month = month; c.day = day
        return Calendar.current.date(from: c)
    }
}

struct FinancesCreditCard: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let statementDay: Int
    let dueDay: Int
    let plaidAccountId: String?
}

struct FinancesMonthlyBill: Codable, Identifiable, Hashable {
    var id: String { "\(cardId)-\(year)-\(month)" }
    let cardId: String
    let year: Int
    let month: Int
    let billed: Double?
    let spent: Double?
}

struct FinancesPaycheck: Codable, Identifiable, Hashable {
    let id: String
    let year: Int
    let month: Int
    let day: Int
    let amount: Double
    let note: String?
}

struct FinancesPlaidSubAccount: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let type: String
    let subtype: String?
    let mask: String?
}

struct FinancesPlaidAccount: Codable, Identifiable, Hashable {
    let id: String
    let institutionId: String
    let institutionName: String
    let accounts: [FinancesPlaidSubAccount]
    let lastSynced: String?
}

/// Top-level shape returned by GET /api/data. Many fields are optional because
/// the Node backend stores whatever the web app writes — we only decode what
/// iOS needs for v1.
struct FinancesState: Codable {
    let activeYear: Int?
    let creditCards: [FinancesCreditCard]?
    let monthlyBills: [FinancesMonthlyBill]?
    let paychecks: [FinancesPaycheck]?
    let transactions: [FinancesTransaction]?
    let currentBalance: Double?
    let currentBalanceDate: String?
    let plaidAccounts: [FinancesPlaidAccount]?
}
