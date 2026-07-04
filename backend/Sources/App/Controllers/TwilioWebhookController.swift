import Vapor
import Fluent

struct TwilioWebhookController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let twilio = routes.grouped("twilio")
        twilio.post("incoming", use: incoming)
    }

    // Twilio posts application/x-www-form-urlencoded
    struct IncomingSMS: Content {
        var From: String
        var To: String
        var Body: String
        var MessageSid: String?
        static let defaultContentType: HTTPMediaType = .urlEncodedForm
    }

    @Sendable
    func incoming(req: Request) async throws -> Response {
        let sms = try req.content.decode(IncomingSMS.self)
        req.logger.info("Incoming SMS from \(sms.From): \(sms.Body)")

        // Signature validation (optional in dev — disable with TWILIO_VALIDATE_SIGNATURE=0)
        if Environment.get("TWILIO_VALIDATE_SIGNATURE") != "0",
           let authToken = Environment.get("TWILIO_AUTH_TOKEN"),
           let signature = req.headers.first(name: "X-Twilio-Signature") {
            let url = "\(req.url)"
            let params = (try? req.content.decode([String: String].self,
                                                   as: .urlEncodedForm)) ?? [:]
            let fullURL = Environment.get("TWILIO_WEBHOOK_BASE").map { "\($0)\(req.url.path)" } ?? url
            if !TwilioService.validateSignature(url: fullURL, params: params,
                                                signature: signature, authToken: authToken) {
                req.logger.warning("Rejected SMS — bad Twilio signature")
                throw Abort(.forbidden, reason: "Invalid Twilio signature")
            }
        }

        // Publish to broker — consumer handles parsing, DB writes, and the Twilio reply.
        let payload = SMSInboundPayload(
            twilioSid: sms.MessageSid,
            from: sms.From, to: sms.To, body: sms.Body,
            receivedAt: Date()
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(payload)
        try await req.broker.publish(topic: BrokerTopic.smsInbound, key: sms.From, data: data)

        // Respond immediately with empty TwiML — Twilio needs a fast reply (<15s).
        let xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>"
        let response = Response(status: .ok, body: .init(string: xml))
        response.headers.replaceOrAdd(name: .contentType, value: "application/xml")
        return response
    }
}
