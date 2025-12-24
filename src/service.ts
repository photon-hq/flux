// Defines the gRPC FluxService interface for CLI-server communication.
import { server, client, bidi, Service } from "better-grpc";
import { IncomingMessage, OutgoingMessage } from "./models";

// Not exported to avoid DTS build issues with better-grpc internal types
abstract class FluxService extends Service("FluxService") {
  sendMessage = server<(message: OutgoingMessage) => { success: boolean; error?: string }>();
  messageStream = bidi<(message: IncomingMessage | { ack: string }) => void>();
  registerAgent = server<(phoneNumber: string) => { success: boolean; error?: string }>();
  unregisterAgent = server<(phoneNumber: string) => { success: boolean }>();
  onIncomingMessage = client<(message: IncomingMessage) => { received: boolean }>();
  validateUser = server<(phoneNumber: string) => { exists: boolean; created: boolean; error?: string }>();
}

export { FluxService };