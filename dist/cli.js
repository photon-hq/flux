#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/cli.ts
var cli_exports = {};
__export(cli_exports, {
  FluxClient: () => FluxClient
});
module.exports = __toCommonJS(cli_exports);
var import_better_grpc = require("better-grpc");
var import_cli_chat = require("@photon-ai/rapid/cli-chat");
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var readline = __toESM(require("readline"));
var import_url = require("url");
var GRPC_SERVER_ADDRESS = process.env.FLUX_SERVER_ADDRESS || "localhost:50051";
var CONFIG_DIR = path.join(process.env.HOME || "~", ".flux");
var CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
var AGENT_FILE_NAME = "agent.ts";
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {
  }
  return {};
}
function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
function clearConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}
async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
async function login() {
  const phoneNumber = await prompt("Enter your phone number (e.g. +15551234567): ");
  if (!phoneNumber.match(/^\+?[0-9]{10,15}$/)) {
    console.error("Invalid phone number format.");
    process.exit(1);
  }
  console.log("[FLUX] Validating with server...");
  try {
    const clientImpl = FluxService.Client({
      async onIncomingMessage() {
        return { received: true };
      }
    });
    const client2 = await (0, import_better_grpc.createGrpcClient)(GRPC_SERVER_ADDRESS, clientImpl);
    const result = await client2.FluxService.validateUser(phoneNumber);
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
  } catch (error) {
    console.error(`[FLUX] Failed to connect to server: ${error.message}`);
    console.error(`[FLUX] Make sure the Flux server is running at ${GRPC_SERVER_ADDRESS}`);
    process.exit(1);
  }
}
function logout() {
  clearConfig();
  console.log("[FLUX] Logged out.");
}
async function getPhoneNumber() {
  const config = loadConfig();
  if (config.phoneNumber) {
    return config.phoneNumber;
  }
  console.log("[FLUX] Not logged in.");
  return await login();
}
function findAgentFile() {
  const cwd = process.cwd();
  const agentPath = path.join(cwd, AGENT_FILE_NAME);
  if (fs.existsSync(agentPath)) {
    return agentPath;
  }
  const jsPath = path.join(cwd, "agent.js");
  if (fs.existsSync(jsPath)) {
    return jsPath;
  }
  return null;
}
async function validateAgentFile(agentPath) {
  try {
    const moduleUrl = (0, import_url.pathToFileURL)(agentPath).href;
    const agentModule = await import(moduleUrl);
    if (!agentModule.default) {
      return { valid: false, error: "No default export found. Use `export default agent`" };
    }
    const agent = agentModule.default;
    if (typeof agent.invoke !== "function") {
      return { valid: false, error: "Agent must have an `invoke` method" };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Failed to load agent: ${error.message}` };
  }
}
async function loadAgent(agentPath) {
  const moduleUrl = (0, import_url.pathToFileURL)(agentPath).href;
  const agentModule = await import(moduleUrl);
  return agentModule.default;
}
var FluxService = class extends (0, import_better_grpc.Service)("FluxService") {
  sendMessage = (0, import_better_grpc.server)();
  messageStream = (0, import_better_grpc.bidi)();
  registerAgent = (0, import_better_grpc.server)();
  unregisterAgent = (0, import_better_grpc.server)();
  onIncomingMessage = (0, import_better_grpc.client)();
  // Login validation - checks if user exists in Firebase
  validateUser = (0, import_better_grpc.server)();
};
var FluxClient = class {
  client = null;
  phoneNumber;
  onMessage;
  constructor(phoneNumber, onMessage) {
    this.phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, "");
    this.onMessage = onMessage;
  }
  async connect() {
    const clientImpl = FluxService.Client({
      async onIncomingMessage(message) {
        return { received: true };
      }
    });
    this.client = await (0, import_better_grpc.createGrpcClient)(GRPC_SERVER_ADDRESS, clientImpl);
    console.log(`[FLUX] Connected to server at ${GRPC_SERVER_ADDRESS}`);
  }
  async register() {
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
  async startMessageStream() {
    if (!this.client) return;
    (async () => {
      for await (const [message] of this.client.FluxService.messageStream) {
        if ("ack" in message) {
          console.log(`[FLUX] Received ack: ${message.ack}`);
        } else {
          console.log(`[FLUX] Incoming message from ${message.userPhoneNumber}: ${message.text}`);
          await this.client.FluxService.messageStream({ ack: message.messageGuid });
          const response = await this.onMessage(message);
          if (response) {
            await this.sendMessage(message.userPhoneNumber, response, message.chatGuid);
          }
        }
      }
    })();
  }
  async sendMessage(to, text, chatGuid) {
    if (!this.client) throw new Error("Not connected. Call connect() first.");
    const result = await this.client.FluxService.sendMessage({
      userPhoneNumber: to,
      text,
      chatGuid
    });
    if (!result.success) {
      console.error(`[FLUX] Send failed: ${result.error}`);
    }
    return result.success;
  }
  async disconnect() {
    if (!this.client) return;
    await this.client.FluxService.unregisterAgent(this.phoneNumber);
    console.log(`[FLUX] Unregistered agent for ${this.phoneNumber}`);
    this.client = null;
  }
};
async function validateCommand() {
  const agentPath = findAgentFile();
  if (!agentPath) {
    console.error("[FLUX] No agent.ts or agent.js found in current directory.");
    console.error("[FLUX] Create an agent.ts file with `export default agent`");
    return false;
  }
  console.log(`[FLUX] Validating ${path.basename(agentPath)}...`);
  const result = await validateAgentFile(agentPath);
  if (result.valid) {
    console.log("[FLUX] \u2713 Agent is valid!");
    return true;
  } else {
    console.error(`[FLUX] \u2717 Validation failed: ${result.error}`);
    return false;
  }
}
async function runLocal() {
  const agentPath = findAgentFile();
  if (!agentPath) {
    console.error("[FLUX] No agent.ts or agent.js found in current directory.");
    console.error("[FLUX] Create an agent.ts file with `export default agent`");
    process.exit(1);
  }
  const validation = await validateAgentFile(agentPath);
  if (!validation.valid) {
    console.error(`[FLUX] Agent validation failed: ${validation.error}`);
    process.exit(1);
  }
  const agent = await loadAgent(agentPath);
  const chat = (0, import_cli_chat.renderChatUI)();
  chat.sendMessage("Welcome to Flux! Your agent is loaded. Type a message to test it.");
  chat.onInput(async (input) => {
    chat.sendMessage("Thinking...");
    try {
      const response = await agent.invoke({
        message: input,
        userPhoneNumber: "+1234567890"
        // Mock phone number for local testing
      });
      chat.sendMessage(response);
    } catch (error) {
      chat.sendMessage(`Error: ${error.message}`);
    }
  });
  await new Promise(() => {
  });
}
async function runProd() {
  const phoneNumber = await getPhoneNumber();
  const agentPath = findAgentFile();
  if (!agentPath) {
    console.error("[FLUX] No agent.ts or agent.js found in current directory.");
    console.error("[FLUX] Create an agent.ts file with `export default agent`");
    process.exit(1);
  }
  const validation = await validateAgentFile(agentPath);
  if (!validation.valid) {
    console.error(`[FLUX] Agent validation failed: ${validation.error}`);
    process.exit(1);
  }
  console.log(`[FLUX] Loading agent from ${path.basename(agentPath)}...`);
  const agent = await loadAgent(agentPath);
  console.log("[FLUX] Agent loaded successfully!");
  const flux = new FluxClient(phoneNumber, async (message) => {
    console.log(`[FLUX] Processing message from ${message.userPhoneNumber}: ${message.text}`);
    try {
      const response = await agent.invoke({
        message: message.text,
        userPhoneNumber: message.userPhoneNumber,
        imageBase64: message.imageBase64
      });
      console.log(`[FLUX] Agent response: ${response}`);
      return response;
    } catch (error) {
      console.error(`[FLUX] Agent error: ${error.message}`);
      return "Sorry, I encountered an error processing your message.";
    }
  });
  await flux.connect();
  await flux.register();
  console.log("[FLUX] Agent running in production mode. Press Ctrl+C to stop.");
  console.log(`[FLUX] Messages to ${phoneNumber} will be processed by your agent.
`);
  process.on("SIGINT", async () => {
    console.log("\n[FLUX] Shutting down...");
    await flux.disconnect();
    process.exit(0);
  });
  await new Promise(() => {
  });
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FluxClient
});
