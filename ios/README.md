# HealthTracker iOS App

SwiftUI app that talks to the Vapor backend in `../backend`.

## Setup

Since Xcode projects (.xcodeproj) are complex to generate outside Xcode, here's the one-time setup:

### 1. Create a new Xcode project

1. Open Xcode → File → New → Project
2. Choose **iOS → App**
3. Product Name: `HealthTracker`
4. Interface: **SwiftUI**
5. Language: **Swift**
6. Save it **inside this `ios/` folder** (so the .xcodeproj ends up alongside the `HealthTracker/` source folder)

### 2. Delete the template files

Xcode creates `ContentView.swift` and `HealthTrackerApp.swift` by default. **Delete both** (move to trash) — our versions are in `HealthTracker/`.

### 3. Add the source files

In Xcode's Project Navigator, right-click the `HealthTracker` group → **Add Files to "HealthTracker"** → select the folders:

- `App/`
- `Models/`
- `Services/`
- `Views/`

Make sure "Create groups" is selected and the HealthTracker target is checked.

### 4. (Optional) Device setup

`APIConfig.baseURL` in `Services/APIClient.swift` defaults to `http://127.0.0.1:8080`.

- **Simulator**: works as-is (loopback reaches your Mac)
- **Physical device**: change to your Mac's LAN IP (e.g., `http://192.168.1.42:8080`) and make sure your Mac and phone are on the same Wi-Fi
- **App Transport Security**: Since we're using plain HTTP for local dev, add to `Info.plist`:
  ```xml
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
  </dict>
  ```

### 5. Run

Make sure the Vapor backend is running:

```bash
cd ../backend
swift run App serve --hostname 0.0.0.0 --port 8080
```

Then run the iOS app in Xcode (Cmd+R).

## Structure

```
HealthTracker/
├── App/                    # App entry point and tab root
├── Models/                 # Codable structs mirroring backend DTOs
├── Services/               # APIClient (networking + token storage)
└── Views/
    ├── AuthView.swift      # Login / register
    ├── DashboardView.swift # Today's calories, latest weight, recent workouts
    ├── WeightView.swift    # Log weight + Swift Charts trend
    ├── WorkoutsView.swift  # List + log workout with exercises/sets
    └── FoodView.swift      # List + log food via USDA search
```

## Notes

- Token is persisted in `UserDefaults` (good enough for dev; move to Keychain for production)
- iOS 17+ recommended (uses `NavigationStack`, `Charts`, `onChange(of:)` modern API)
