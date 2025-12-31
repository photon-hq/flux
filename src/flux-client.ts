// gRPC client that connects to the Flux server and handles message streaming.
import { createGrpcClient } from "better-grpc";
import { FluxService } from "./service";
import { IncomingMessage } from "./models";
import { TapbackType } from "./agent-type";

const GRPC_SERVER_ADDRESS = process.env.FLUX_SERVER_ADDRESS || "fluxy.photon.codes:443";

function splitIntoMessages(response: string): string[] {
  if (!response.includes('\n')) {
    return [response];
  }

  const parts = response.split('\n').map(p => p.trim()).filter(p => p);
  return parts.length > 0 ? parts : [response];
}

export class FluxClient {
  private client: Awaited<ReturnType<typeof createGrpcClient>> | null = null;
  private phoneNumber: string;
  private token: string;
  private onMessage: (message: IncomingMessage) => Promise<string | void>;

  constructor(
    phoneNumber: string,
    token: string,
    onMessage: (message: IncomingMessage) => Promise<string | void>
  ) {
    this.phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, "");
    this.token = token;
    this.onMessage = onMessage;
  }

  async connect(): Promise<void> {
    const clientImpl = FluxService.Client({
      async onIncomingMessage(message: IncomingMessage) {
        return { received: true };
      },
    });

    this.client = (await createGrpcClient(GRPC_SERVER_ADDRESS, clientImpl)) as unknown as Awaited<ReturnType<typeof createGrpcClient>>;
    console.log(`[FLUX] Connected to server at ${GRPC_SERVER_ADDRESS}`);
  }

  async register(): Promise<boolean> {
    if (!this.client) throw new Error("Not connected. Call connect() first.");

    const result = await this.client.FluxService.registerAgent(this.phoneNumber, this.token);
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
      const stream = this.client!.FluxService.messageStream;
      for await (const [message] of stream as AsyncIterable<[IncomingMessage | { ack: string }]>) {
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
            const messages = splitIntoMessages(response);
            for (const msg of messages) {
              await this.sendMessage(message.userPhoneNumber, msg);
            }
          }
        }
      }
    })();
  }

  async sendMessage(to: string, text: string): Promise<boolean> {
    if (!this.client) throw new Error("Not connected. Call connect() first.");

    const result = await this.client.FluxService.sendMessage({
      userPhoneNumber: to,
      text,
    });

    if (!result.success) {
      console.error(`[FLUX] Send failed: ${result.error}`);
    }
    return result.success;
  }

  async sendTapback(messageGuid: string, reaction: TapbackType): Promise<boolean> {
    if (!this.client) throw new Error("Not connected. Call connect() first.");

    console.log(`[FLUX] Sending tapback: messageGuid=${messageGuid}, reaction=${reaction}`);

    try {
      const result = await this.client.FluxService.sendTapback({
        messageGuid,
        reaction,
      });

      if (result.success) {
        console.log(`[FLUX] Tapback sent successfully!`);
      } else {
        console.error(`[FLUX] Tapback failed: ${result.error}`);
      }
      return result.success;
    } catch (error: any) {
      console.error(`[FLUX] Tapback error: ${error.message}`);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;

    await this.client.FluxService.unregisterAgent(this.phoneNumber);
    console.log(`[FLUX] Unregistered agent for ${this.phoneNumber}`);
    this.client = null;
  }
}
