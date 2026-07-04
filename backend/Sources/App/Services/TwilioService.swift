import Vapor
import Crypto

/// Thin wrapper around the Twilio REST API for sending SMS + validating incoming webhooks.
///
/// Env vars:
///   - TWILIO_ACCOUNT_SID
///   - TWILIO_AUTH_TOKEN
///   - TWILIO_FROM_NUMBER    (your Twilio phone number, E.164 format e.g. "+15551234567")
struct TwilioService {
    let client: Client
    let logger: Logger
    let accountSid: String
    let authToken: String
    let fromNumber: String

    init(client: Client, logger: Logger) throws {
        guard let sid = Environment.get("TWILIO_ACCOUNT_SID"),
              let token = Environment.get("TWILIO_AUTH_TOKEN"),
              let from = Environment.get("TWILIO_FROM_NUMBER") else {
            throw Abort(.internalServerError,
                        reason: "Twilio env vars not set (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)")
        }
        self.client = client
        self.logger = logger
        self.accountSid = sid
        self.authToken = token
        self.fromNumber = from
    }

    func send(to phone: String, body: String) async throws {
        let url = URI(string: "https://api.twilio.com/2010-04-01/Accounts/\(accountSid)/Messages.json")
        let auth = Data("\(accountSid):\(authToken)".utf8).base64EncodedString()

        struct FormBody: Content {
            var To: String; var From: String; var Body: String
            static let defaultContentType: HTTPMediaType = .urlEncodedForm
        }

        let resp = try await client.post(url, headers: ["Authorization": "Basic \(auth)"]) { req in
            try req.content.encode(FormBody(To: phone, From: fromNumber, Body: body),
                                   as: .urlEncodedForm)
        }
        guard (200...299).contains(resp.status.code) else {
            let body = resp.body.map { String(buffer: $0) } ?? ""
            logger.warning("Twilio send failed \(resp.status.code): \(body)")
            throw Abort(.badGateway, reason: "Twilio send failed")
        }
    }

    /// Validates the X-Twilio-Signature header against the full request URL + POST parameters.
    /// https://www.twilio.com/docs/usage/security#validating-requests
    static func validateSignature(url: String, params: [String: String],
                                  signature: String, authToken: String) -> Bool {
        let sortedKeys = params.keys.sorted()
        var data = url
        for key in sortedKeys {
            data += key + (params[key] ?? "")
        }
        let key = SymmetricKey(data: Data(authToken.utf8))
        let mac = HMAC<Insecure.SHA1>.authenticationCode(for: Data(data.utf8), using: key)
        let expected = Data(mac).base64EncodedString()
        return expected == signature
    }
}
