// gRPC client that connects to the Flux server and handles message streaming.
import { createGrpcClient } from "better-grpc";
import { FluxService } from "./service";
import { IncomingMessage } from "./models";

const GRPC_SERVER_ADDRESS = process.env.FLUX_SERVER_ADDRESS || "fluxy.photon.codes:443";

export class FluxClient {
  private client: Awaited<ReturnType<typeof createGrpcClient>> | null = null;
  private phoneNumber: string;
  private onMessage: (message: IncomingMessage) => Promise<string | void>;

  constructor(
    phoneNumber: string,
    onMessage: (message: IncomingMessage) => Promise<string | void>
  ) {
    this.phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, "");
    this.onMessage = onMessage;
  }

  async connect(): Promise<void> {
    const clientImpl = FluxService.Client({
      async onIncomingMessage(message: IncomingMessage) {
        return { received: true };
      },
    });

    this.client = await createGrpcClient(GRPC_SERVER_ADDRESS, clientImpl);
    console.log(`[FLUX] Connected to server at ${GRPC_SERVER_ADDRESS}`);
  }

  async register(): Promise<boolean> {
    if (!this.client) throw new Error("Not connected. Call connect() first.");

    const result = await this.client.FluxService.registerAgent(this.phoneNumber);
    if (result.success) {
      console.log(`[FLUX] Registered agent for ${this.phoneNumber}`);
      this.startMessageStream();
    } else {
      console.error(`[FLUX] Registration failed: ${result.error}`);
    }
    return result.success;
  }

  private async startMessageStream(): Promise<void> {
    if (!this.client) return;

    (async () => {
      for await (const [message] of this.client!.FluxService.messageStream) {
        if ("ack" in message) {
          console.log(`[FLUX] Received ack: ${message.ack}`);
        } else {
          console.log(`[FLUX] Incoming message from ${message.userPhoneNumber}: ${message.text}`);

          // Acknowledge receipt
          await this.client!.FluxService.messageStream({ ack: message.messageGuid });

          // Process with user's agent and get response
          const response = await this.onMessage(message);

          // Send response if agent returned one
          if (response) {
            await this.sendMessage(message.userPhoneNumber, response, message.chatGuid);
          }
        }
      }
    })();
  }

  async sendMessage(to: string, text: string, chatGuid?: string): Promise<boolean> {
    if (!this.client) throw new Error("Not connected. Call connect() first.");

    const result = await this.client.FluxService.sendMessage({
      userPhoneNumber: to,
      text,
      chatGuid,
    });

    if (!result.success) {
      console.error(`[FLUX] Send failed: ${result.error}`);
    }
    return result.success;
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;

    await this.client.FluxService.unregisterAgent(this.phoneNumber);
    console.log(`[FLUX] Unregistered agent for ${this.phoneNumber}`);
    this.client = null;
  }
}
