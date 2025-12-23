/**
 * Mock Flux Server for Testing gRPC Connection
 * =============================================
 * This simulates the Flux Server's gRPC interface for local testing.
 * Run this before running the CLI to test the connection.
 *
 * Usage: npx tsx src/mock-server.ts
 */

import {
  Service,
  server,
  client,
  bidi,
  createGrpcServer,
} from "better-grpc";

// --- Message Types (must match cli.ts) ---

interface IncomingMessage {
  userPhoneNumber: string;
  text: string;
  imageBase64?: string;
  chatGuid: string;
  messageGuid: string;
}

interface OutgoingMessage {
  userPhoneNumber: string;
  text: string;
  chatGuid?: string;
}

// --- FluxService Definition (must match cli.ts) ---

abstract class FluxService extends Service("FluxService") {
  sendMessage = server<
    (message: OutgoingMessage) => { success: boolean; error?: string }
  >();
  messageStream = bidi<(message: IncomingMessage | { ack: string }) => void>();
  registerAgent = server<
    (phoneNumber: string) => { success: boolean; error?: string }
  >();
  unregisterAgent = server<(phoneNumber: string) => { success: boolean }>();
  onIncomingMessage = client<
    (message: IncomingMessage) => { received: boolean }
  >();
}

// --- Registered Agents Store ---

const registeredAgents = new Map<string, boolean>();

// --- Server Implementation ---

const fluxServerImpl = FluxService.Server({
  async sendMessage(message: OutgoingMessage) {
    console.log(`[SERVER] Outgoing message to ${message.userPhoneNumber}:`);
    console.log(`         "${message.text}"`);
    console.log(`         chatGuid: ${message.chatGuid || "new chat"}`);
    return { success: true };
  },

  async registerAgent(phoneNumber: string) {
    console.log(`[SERVER] Agent registered for: ${phoneNumber}`);
    registeredAgents.set(phoneNumber, true);

    // Simulate sending a test message after registration
    setTimeout(() => {
      simulateIncomingMessage(phoneNumber);
    }, 2000);

    return { success: true };
  },

  async unregisterAgent(phoneNumber: string) {
    console.log(`[SERVER] Agent unregistered for: ${phoneNumber}`);
    registeredAgents.delete(phoneNumber);
    return { success: true };
  },
});

// --- Simulate Incoming Messages ---

let grpcServer: Awaited<ReturnType<typeof createGrpcServer>> | null = null;

async function simulateIncomingMessage(phoneNumber: string) {
  if (!grpcServer) return;

  const testMessage: IncomingMessage = {
    userPhoneNumber: phoneNumber,
    text: "Hello from mock server! This is a test message.",
    chatGuid: "test-chat-guid-12345",
    messageGuid: `msg-${Date.now()}`,
  };

  console.log(`[SERVER] Simulating incoming message to ${phoneNumber}...`);

  // Use bidi stream to send message to client
  await grpcServer.FluxService.messageStream(testMessage);
}

// --- Main Server ---

async function main() {
  const PORT = 50051;

  grpcServer = await createGrpcServer(PORT, fluxServerImpl);
  console.log(`[SERVER] Mock Flux Server running on port ${PORT}`);
  console.log(`[SERVER] Waiting for CLI connections...`);
  console.log("");
  console.log("To test, run in another terminal:");
  console.log("  PHONE_NUMBER=+15551234567 npx tsx src/cli.ts");
  console.log("");

  // Interactive mode: send test messages on command
  process.stdin.on("data", async (data) => {
    const input = data.toString().trim();

    if (input === "send") {
      // Send a test message to all registered agents
      for (const phoneNumber of registeredAgents.keys()) {
        await simulateIncomingMessage(phoneNumber);
      }
    } else if (input === "list") {
      console.log("[SERVER] Registered agents:", [...registeredAgents.keys()]);
    } else if (input === "help") {
      console.log("Commands:");
      console.log("  send  - Send test message to all registered agents");
      console.log("  list  - List all registered agents");
      console.log("  help  - Show this help");
    }
  });

  // Keep server alive
  await new Promise(() => {});
}

main().catch(console.error);
