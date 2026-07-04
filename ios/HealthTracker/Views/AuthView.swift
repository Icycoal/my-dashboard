import SwiftUI

struct AuthView: View {
    @EnvironmentObject var api: APIClient
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .submitLabel(.go)
                        .onSubmit { Task { await submit() } }
                }

                if let error {
                    Text(error).foregroundStyle(.red).font(.footnote)
                }

                Button("Sign In") {
                    Task { await submit() }
                }.disabled(busy || password.isEmpty)
            }
            .navigationTitle("Sign In")
        }
    }

    func submit() async {
        busy = true; error = nil
        do {
            try await api.passwordLogin(password: password)
        } catch {
            self.error = error.localizedDescription
        }
        busy = false
    }
}
