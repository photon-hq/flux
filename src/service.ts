import {server, Service} from "better-grpc";

abstract class FluxService extends Service("FluxService") {
    // CLI calls this to send a message out via iMessage
    sendMessage = server<(message: OutgoingMessage) => { success: boolean; error?: string }>();

    // Bidirectional stream for incoming messages
    // Server pushes messages to connected CLIs, CLI acknowledges receipt
    messageStream = bidi<(message: IncomingMessage | { ack: string }) => void>();

    // CLI calls this to register an agent for a phone number
    registerAgent = server<(phoneNumber: string) => { success: boolean; error?: string }>();

    // CLI calls this to unregister/disconnect
    unregisterAgent = server<(phoneNumber: string) => { success: boolean }>();

    // CLI calls this to validate/create a user during login
    validateUser = server<(phoneNumber: string) => { exists: boolean; created: boolean; error?: string }>();

    // Server calls this to notify CLI of incoming message (alternative to stream)
    onIncomingMessage = client<(message: IncomingMessage) => { received: boolean }>();
}