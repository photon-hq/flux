/**
 * Flux CLI - gRPC Client for iMessage Bridge
 * ==========================================
 * This code connects the Flux CLI to the Flux Server's iMessage bridge.
 */

import { Service, server, client, bidi, createGrpcClient } from "better-grpc";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// --- Configuration ---
const GRPC_SERVER_ADDRESS = process.env.FLUX_SERVER_ADDRESS || "localhost:50051";
const CONFIG_DIR = path.join(process.env.HOME || "~", ".flux");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// --- Auth Storage ---

interface FluxConfig {
  phoneNumber?: string;
}

function loadConfig(): FluxConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveConfig(config: FluxConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function clearConfig(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function login(): Promise<string> {
  const phoneNumber = await prompt("Enter your phone number (e.g. +15551234567): ");
  if (!phoneNumber.match(/^\+?[0-9]{10,15}$/)) {
    console.error("Invalid phone number format.");
    process.exit(1);
  }

  // Validate with server (checks/creates user in Firebase)
  console.log("[FLUX] Validating with server...");
  try {
    const clientImpl = FluxService.Client({
      async onIncomingMessage() {
        return { received: true };
      },
    });
    const client = await createGrpcClient(GRPC_SERVER_ADDRESS, clientImpl);
    const result = await client.FluxService.validateUser(phoneNumber);

    if (result.error) {
      console.error(`[FLUX] Login failed: ${result.error}`);
      process.exit(1);
    }

    if (result.created) {
      console.log(`[FLUX] New account created for ${phoneNumber}`);
    } else if (result.exists) {
      console.log(`[FLUX] Welcome back, ${phoneNumber}`);
    }

    saveConfig({ phoneNumber });
    console.log(`[FLUX] Logged in as ${phoneNumber}`);
    return phoneNumber;
  } catch (error: any) {
    console.error(`[FLUX] Failed to connect to server: ${error.message}`);
    console.error(`[FLUX] Make sure the Flux server is running at ${GRPC_SERVER_ADDRESS}`);
    process.exit(1);
  }
}

function logout(): void {
  clearConfig();
  console.log("[FLUX] Logged out.");
}

async function getPhoneNumber(): Promise<string> {
  const config = loadConfig();
  if (config.phoneNumber) {
    return config.phoneNumber;
  }
  console.log("[FLUX] Not logged in.");
  return await login();
}

// --- Message Types ---

export interface IncomingMessage {
  userPhoneNumber: string;
  text: string;
  imageBase64?: string;
  chatGuid: string;
  messageGuid: string;
}

export interface OutgoingMessage {
  userPhoneNumber: string;
  text: string;
  chatGuid?: string;
}

// --- FluxService Definition (must match server) ---

abstract class FluxService extends Service("FluxService") {
  sendMessage = server<(message: OutgoingMessage) => { success: boolean; error?: string }>();
  messageStream = bidi<(message: IncomingMessage | { ack: string }) => void>();
  registerAgent = server<(phoneNumber: string) => { success: boolean; error?: string }>();
  unregisterAgent = server<(phoneNumber: string) => { success: boolean }>();
  onIncomingMessage = client<(message: IncomingMessage) => { received: boolean }>();
  // Login validation - checks if user exists in Firebase
  validateUser = server<(phoneNumber: string) => { exists: boolean; created: boolean; error?: string }>();
}

// --- FluxClient Class ---

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

// --- CLI Commands ---

async function runAgent() {
  const phoneNumber = await getPhoneNumber();

  // Create client with message handler (this is where your LangChain agent goes)
  const flux = new FluxClient(phoneNumber, async (message) => {
    console.log(`Processing: ${message.text}`);

    // TODO: Replace with your LangChain agent
    return `${message.text}`;
  });

  // Connect and register
  await flux.connect();
  await flux.register();

  console.log("[FLUX] Agent running. Press Ctrl+C to stop.");

  // Handle shutdown
  process.on("SIGINT", async () => {
    await flux.disconnect();
    process.exit(0);
  });

  // Keep alive
  await new Promise(() => {});
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "login":
      await login();
      break;
    case "logout":
      logout();
      break;
    case "run":
      await runAgent();
      break;
    case "whoami":
      const config = loadConfig();
      if (config.phoneNumber) {
        console.log(`[FLUX] Logged in as ${config.phoneNumber}`);
      } else {
        console.log("[FLUX] Not logged in.");
      }
      break;
    default:
      console.log("Flux CLI - Connect LangChain agents to iMessage\n");
      console.log("Commands:");
      console.log("  flux login   - Log in with your phone number");
      console.log("  flux logout  - Log out");
      console.log("  flux run     - Run your agent");
      console.log("  flux whoami  - Show current logged in user");
      break;
  }
}

main().catch(console.error);