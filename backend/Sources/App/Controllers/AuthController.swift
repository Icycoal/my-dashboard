import Vapor
import Fluent
import JWT

struct AuthController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let auth = routes.grouped("auth")
        auth.post("register", use: register)
        auth.post("login", use: login)
        auth.post("password", use: passwordLogin)
    }

    struct RegisterDTO: Content {
        let name: String
        let email: String
        let password: String
        let phoneNumber: String?
        let timezone: String?
    }

    struct LoginDTO: Content {
        let email: String
        let password: String
    }

    struct PasswordDTO: Content {
        let password: String
    }

    struct TokenResponse: Content {
        let token: String
        let userId: UUID
        let name: String
        let email: String
    }

    @Sendable
    func register(req: Request) async throws -> TokenResponse {
        guard Environment.get("ALLOW_REGISTER") == "true" else {
            throw Abort(.forbidden, reason: "Registration is disabled. Set ALLOW_REGISTER=true to enable bootstrap.")
        }
        let dto = try req.content.decode(RegisterDTO.self)
        let hash = try Bcrypt.hash(dto.password)
        let user = User(
            name: dto.name,
            email: dto.email.lowercased(),
            passwordHash: hash,
            phoneNumber: dto.phoneNumber,
            timezone: dto.timezone ?? "America/New_York"
        )
        try await user.save(on: req.db)
        return try tokenResponse(for: user, req: req)
    }

    @Sendable
    func login(req: Request) async throws -> TokenResponse {
        let dto = try req.content.decode(LoginDTO.self)
        guard let user = try await User.query(on: req.db)
            .filter(\.$email == dto.email.lowercased())
            .first() else {
            throw Abort(.unauthorized, reason: "Invalid credentials")
        }
        guard try Bcrypt.verify(dto.password, created: user.passwordHash) else {
            throw Abort(.unauthorized, reason: "Invalid credentials")
        }
        return try tokenResponse(for: user, req: req)
    }

    /// Single-user password-only login. If no user exists yet and
    /// ALLOW_REGISTER=true, the first call sets the password and creates
    /// the singleton account. Otherwise it just verifies.
    @Sendable
    func passwordLogin(req: Request) async throws -> TokenResponse {
        let dto = try req.content.decode(PasswordDTO.self)
        if let user = try await User.query(on: req.db).first() {
            guard try Bcrypt.verify(dto.password, created: user.passwordHash) else {
                throw Abort(.unauthorized, reason: "Invalid password")
            }
            return try tokenResponse(for: user, req: req)
        }
        guard Environment.get("ALLOW_REGISTER") == "true" else {
            throw Abort(.notFound, reason: "No account exists. Set ALLOW_REGISTER=true and POST again to bootstrap.")
        }
        let user = User(name: "Owner", email: "owner@local",
                        passwordHash: try Bcrypt.hash(dto.password))
        try await user.save(on: req.db)
        return try tokenResponse(for: user, req: req)
    }

    private func tokenResponse(for user: User, req: Request) throws -> TokenResponse {
        guard let id = user.id else { throw Abort(.internalServerError) }
        let payload = UserToken(
            sub: .init(value: id.uuidString),
            exp: .init(value: Date().addingTimeInterval(60 * 60 * 24 * 30))  // 30 days
        )
        let token = try req.jwt.sign(payload)
        return TokenResponse(token: token, userId: id, name: user.name, email: user.email)
    }
}
