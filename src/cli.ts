/**
 * Flux CLI - gRPC Client for iMessage Bridge
 * ==========================================
 * This code connects the Flux CLI to the Flux Server's iMessage bridge.
 * Users define their LangChain agent in agent.ts with `export default agent`
 */

import { Service, server, client, bidi, createGrpcClient } from "better-grpc";
import { renderChatUI } from "@photon-ai/rapid/cli-chat";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { pathToFileURL } from "url";

// --- Configuration ---
const GRPC_SERVER_ADDRESS = process.env.FLUX_SERVER_ADDRESS || "localhost:50051";
const CONFIG_DIR = path.join(process.env.HOME || "~", ".flux");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const AGENT_FILE_NAME = "agent.ts";

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

// --- Agent Types ---

/**
 * FluxAgent interface - users must export default an object matching this interface
 * The agent receives a message and returns a response string
 */
export interface FluxAgent {
  invoke: (input: { message: string; userPhoneNumber: string; imageBase64?: string }) => Promise<string>;
}

// --- Agent Loader ---

/**
 * Find agent.ts in the current working directory
 */
function findAgentFile(): string | null {
  const cwd = process.cwd();
  const agentPath = path.join(cwd, AGENT_FILE_NAME);

  if (fs.existsSync(agentPath)) {
    return agentPath;
  }

  // Also check for agent.js
  const jsPath = path.join(cwd, "agent.js");
  if (fs.existsSync(jsPath)) {
    return jsPath;
  }

  return null;
}

/**
 * Validate that the agent file exports a default agent with invoke method
 */
async function validateAgentFile(agentPath: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const moduleUrl = pathToFileURL(agentPath).href;
    const agentModule = await import(moduleUrl);

    if (!agentModule.default) {
      return { valid: false, error: "No default export found. Use `export default agent`" };
    }

    const agent = agentModule.default;

    if (typeof agent.invoke !== "function") {
      return { valid: false, error: "Agent must have an `invoke` method" };
    }

    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: `Failed to load agent: ${error.message}` };
  }
}

/**
 * Load the agent from agent.ts
 */
async function loadAgent(agentPath: string): Promise<FluxAgent> {
  const moduleUrl = pathToFileURL(agentPath).href;
  const agentModule = await import(moduleUrl);
  return agentModule.default as FluxAgent;
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

/**
 * Validate command - checks if agent.ts exports correctly
 */
async function validateCommand(): Promise<boolean> {
  const agentPath = findAgentFile();

  if (!agentPath) {
    console.error("[FLUX] No agent.ts or agent.js found in current directory.");
    console.error("[FLUX] Create an agent.ts file with `export default agent`");
    return false;
  }

  console.log(`[FLUX] Validating ${path.basename(agentPath)}...`);
  const result = await validateAgentFile(agentPath);

  if (result.valid) {
    console.log("[FLUX] ✓ Agent is valid!");
    return true;
  } else {
    console.error(`[FLUX] ✗ Validation failed: ${result.error}`);
    return false;
  }
}

/**
 * Run agent locally (for testing without connecting to bridge)
 * Uses the Rapid TUI chat interface
 */
async function runLocal() {
  const agentPath = findAgentFile();

  if (!agentPath) {
    console.error("[FLUX] No agent.ts or agent.js found in current directory.");
    console.error("[FLUX] Create an agent.ts file with `export default agent`");
    process.exit(1);
  }

  // Validate first
  const validation = await validateAgentFile(agentPath);
  if (!validation.valid) {
    console.error(`[FLUX] Agent validation failed: ${validation.error}`);
    process.exit(1);
  }

  // Load the agent
  const agent = await loadAgent(agentPath);

  // Start the TUI chat interface
  const chat = renderChatUI();

  chat.sendMessage("Welcome to Flux! Your agent is loaded. Type a message to test it.");

  chat.onInput(async (input) => {
    chat.sendMessage("Thinking...");

    try {
      const response = await agent.invoke({
        message: input,
        userPhoneNumber: "+1234567890", // Mock phone number for local testing
      });
      chat.sendMessage(response);
    } catch (error: any) {
      chat.sendMessage(`Error: ${error.message}`);
    }
  });

  // Keep the Ink app alive. Press Ctrl+C to exit.
  await new Promise(() => {});
}

/**
 * Run agent in production mode (connected to bridge)
 */
async function runProd() {
  const phoneNumber = await getPhoneNumber();
  const agentPath = findAgentFile();

  if (!agentPath) {
    console.error("[FLUX] No agent.ts or agent.js found in current directory.");
    console.error("[FLUX] Create an agent.ts file with `export default agent`");
    process.exit(1);
  }

  // Validate first
  const validation = await validateAgentFile(agentPath);
  if (!validation.valid) {
    console.error(`[FLUX] Agent validation failed: ${validation.error}`);
    process.exit(1);
  }

  // Load the agent
  console.log(`[FLUX] Loading agent from ${path.basename(agentPath)}...`);
  const agent = await loadAgent(agentPath);
  console.log("[FLUX] Agent loaded successfully!");

  // Create client with the user's agent as the message handler
  const flux = new FluxClient(phoneNumber, async (message) => {
    console.log(`[FLUX] Processing message from ${message.userPhoneNumber}: ${message.text}`);

    try {
      const response = await agent.invoke({
        message: message.text,
        userPhoneNumber: message.userPhoneNumber,
        imageBase64: message.imageBase64,
      });
      console.log(`[FLUX] Agent response: ${response}`);
      return response;
    } catch (error: any) {
      console.error(`[FLUX] Agent error: ${error.message}`);
      return "Sorry, I encountered an error processing your message.";
    }
  });

  // Connect and register
  await flux.connect();
  await flux.register();

  console.log("[FLUX] Agent running in production mode. Press Ctrl+C to stop.");
  console.log(`[FLUX] Messages to ${phoneNumber} will be processed by your agent.\n`);

  // Handle shutdown
  process.on("SIGINT", async () => {
    console.log("\n[FLUX] Shutting down...");
    await flux.disconnect();
    process.exit(0);
  });

  // Keep alive
  await new Promise(() => {});
}

async function main() {
  const command = process.argv[2];
  const flag = process.argv[3];

  switch (command) {
    case "login":
      await login();
      break;
    case "logout":
      logout();
      break;
    case "run":
      if (flag === "--local") {
        await runLocal();
      } else if (flag === "--prod" || !flag) {
        // Default to prod mode
        await runProd();
      } else {
        console.error(`[FLUX] Unknown flag: ${flag}`);
        console.log("Usage: flux run [--local | --prod]");
      }
      break;
    case "validate":
      await validateCommand();
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
      console.log("  flux login          - Log in with your phone number");
      console.log("  flux logout         - Log out");
      console.log("  flux validate       - Check if agent.ts exports correctly");
      console.log("  flux run --local    - Test agent locally (no server connection)");
      console.log("  flux run --prod     - Run agent connected to bridge (default)");
      console.log("  flux whoami         - Show current logged in user");
      break;
  }
}

main().catch(console.error);