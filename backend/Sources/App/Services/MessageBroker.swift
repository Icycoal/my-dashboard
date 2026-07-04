import Vapor

/// Abstraction over the message queue so we can swap implementations
/// (in-memory for dev, Kafka for production) without touching business logic.
protocol MessageBroker: Sendable {
    /// Publish a message to a topic with an optional key.
    func publish(topic: String, key: String?, data: Data) async throws

    /// Start consuming a topic. The handler is called for each message.
    /// Returns a Task that can be cancelled to stop consumption.
    func consume(topic: String, handler: @escaping @Sendable (Data) async throws -> Void) -> Task<Void, Never>
}

/// Common topic names.
enum BrokerTopic {
    static let smsInbound = "sms.inbound"
    static let smsOutbound = "sms.outbound"
    static let smsDLQ = "sms.dlq"
}

/// In-process broker backed by AsyncStream. Good for dev, testing,
/// and low-volume personal use. Drop in KafkaBroker later for durability + replay.
final class InMemoryBroker: MessageBroker, @unchecked Sendable {
    private let lock = NSLock()
    private var continuations: [String: [AsyncStream<Data>.Continuation]] = [:]
    private let logger: Logger

    init(logger: Logger) { self.logger = logger }

    func publish(topic: String, key: String?, data: Data) async throws {
        lock.lock()
        let conts = continuations[topic] ?? []
        lock.unlock()
        for c in conts { c.yield(data) }
        logger.debug("[broker] publish \(topic) (\(conts.count) subscribers)")
    }

    func consume(topic: String, handler: @escaping @Sendable (Data) async throws -> Void) -> Task<Void, Never> {
        let (stream, continuation) = AsyncStream<Data>.makeStream(bufferingPolicy: .unbounded)
        lock.lock()
        continuations[topic, default: []].append(continuation)
        lock.unlock()

        let logger = self.logger
        return Task {
            for await data in stream {
                do { try await handler(data) }
                catch { logger.warning("[broker] consumer for \(topic) errored: \(error)") }
            }
        }
    }
}

// MARK: - Payloads

struct SMSInboundPayload: Codable {
    let twilioSid: String?
    let from: String
    let to: String
    let body: String
    let receivedAt: Date
}

struct SMSOutboundPayload: Codable {
    let to: String
    let body: String
}
