import SwiftUI

struct FinancesHomeView: View {
    @EnvironmentObject var api: APIClient
    @State private var state: FinancesState?
    @State private var error: String?
    @State private var loading = true

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView()
                } else if let err = error {
                    VStack(spacing: 12) {
                        Text("Couldn't load finances").font(.headline)
                        Text(err).font(.footnote).foregroundStyle(.secondary)
                        Button("Retry") { Task { await load() } }
                    }.padding()
                } else {
                    List {
                        Section("Cash") {
                            HStack {
                                Text("Current balance")
                                Spacer()
                                Text(format(state?.currentBalance ?? 0))
                                    .font(.headline.monospacedDigit())
                            }
                            if let asOf = state?.currentBalanceDate {
                                Text("As of \(asOf)").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        Section("Recent transactions") {
                            let recent = (state?.transactions ?? [])
                                .sorted { lhs, rhs in
                                    (lhs.date ?? .distantPast) > (rhs.date ?? .distantPast)
                                }
                                .prefix(20)
                            if recent.isEmpty {
                                Text("No transactions yet").foregroundStyle(.secondary)
                            } else {
                                ForEach(Array(recent), id: \.id) { tx in
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(tx.description ?? tx.category).lineLimit(1)
                                            Text(tx.category).font(.caption).foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        Text(format(tx.amount))
                                            .font(.callout.monospacedDigit())
                                            .foregroundStyle(tx.amount < 0 ? .primary : .green)
                                    }
                                }
                            }
                        }
                        Section("Connected accounts") {
                            let accts = state?.plaidAccounts ?? []
                            if accts.isEmpty {
                                Text("Link accounts on the web app").foregroundStyle(.secondary)
                            } else {
                                ForEach(accts, id: \.id) { acct in
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(acct.institutionName).font(.subheadline)
                                        ForEach(acct.accounts, id: \.id) { sub in
                                            Text("\(sub.name)\(sub.mask.map { " ····\($0)" } ?? "")")
                                                .font(.caption).foregroundStyle(.secondary)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Finances")
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func load() async {
        loading = true
        error = nil
        do {
            state = try await api.loadFinancesState()
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func format(_ n: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        return f.string(from: NSNumber(value: n)) ?? "$\(n)"
    }
}
