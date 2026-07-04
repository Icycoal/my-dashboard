import SwiftUI

@main
struct HealthTrackerApp: App {
    @StateObject private var api = APIClient.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if api.isAuthenticated {
                    RootTabView()
                } else {
                    AuthView()
                }
            }
            .environmentObject(api)
        }
    }
}

struct RootTabView: View {
    var body: some View {
        TabView {
            HealthTab()
                .tabItem { Label("Health", systemImage: "heart.fill") }
            FinancesHomeView()
                .tabItem { Label("Finances", systemImage: "dollarsign.circle.fill") }
        }
    }
}

struct HealthTab: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Home", systemImage: "house.fill") }
            WeightView()
                .tabItem { Label("Weight", systemImage: "scalemass") }
            WorkoutsView()
                .tabItem { Label("Workouts", systemImage: "figure.strengthtraining.traditional") }
            FoodView()
                .tabItem { Label("Food", systemImage: "fork.knife") }
        }
    }
}
