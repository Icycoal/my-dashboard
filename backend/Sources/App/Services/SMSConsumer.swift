import Vapor
import Fluent

/// LifecycleHandler that subscribes to the broker's sms.inbound topic,
/// runs messages through SMSProcessor, and sends confirmations via Twilio (if configured).
final class SMSConsumer: LifecycleHandler, @unchecked Sendable {
    private var task: Task<Void, Never>?
    private let broker: MessageBroker

    init(broker: MessageBroker) { self.broker = broker }

    func didBoot(_ app: Application) throws {
        app.logger.info("SMSConsumer subscribing to \(BrokerTopic.smsInbound)")
        task = broker.consume(topic: BrokerTopic.smsInbound) { [weak app] data in
            guard let app else { return }
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let payload = try decoder.decode(SMSInboundPayload.self, from: data)

            let processor = SMSProcessor(db: app.db, client: app.client, logger: app.logger)
            let result = try await processor.process(payload)

            // Send confirmation via Twilio if configured
            if Environment.get("TWILIO_ACCOUNT_SID") != nil {
                do {
                    let twilio = try TwilioService(client: app.client, logger: app.logger)
                    try await twilio.send(to: payload.from, body: result.reply)

                    // Record outbound
                    let record = SMSMessage(
                        userId: nil,
                        fromNumber: twilio.fromNumber, toNumber: payload.from,
                        body: result.reply, direction: "outbound"
                    )
                    try await record.save(on: app.db)
                } catch {
                    app.logger.warning("Confirmation SMS failed: \(error)")
                }
            } else {
                app.logger.info("[smsconsumer] Would reply: \(result.reply)")
            }
        }
    }

    func shutdown(_ app: Application) {
        task?.cancel()
        task = nil
    }
}
