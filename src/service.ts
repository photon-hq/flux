// Defines the gRPC FluxService interface for CLI-server communication.
import { server, client, bidi, Service } from "better-grpc";
import { IncomingMessage, OutgoingMessage } from "./models";

// Not exported to avoid DTS build issues with better-grpc internal types
abstract class FluxService extends Service("FluxService") {
  // Message handling
  sendMessage = server<(message: OutgoingMessage) => { success: boolean; error?: string }>();
  messageStream = bidi<(message: IncomingMessage | { ack: string }) => void>();
  registerAgent = server<(phoneNumber: string, token: string) => { success: boolean; error?: string }>();
  unregisterAgent = server<(phoneNumber: string) => { success: boolean }>();
  onIncomingMessage = client<(message: IncomingMessage) => { received: boolean }>();

  // Authentication - iMessage verification flow
  getDynamicCode = server<(clientId: string, phoneNumber: string) => { code: string; error?: string }>();
  waitingVerified = server<(clientId: string) => { token: string; error?: string }>();
  validateToken = server<(token: string) => { valid: boolean; phone: string }>();
  revokeToken = server<(token: string) => { success: boolean }>();
}

export { FluxService };
