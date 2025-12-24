#!/usr/bin/env node
'use strict';

var betterGrpc = require('better-grpc');
var cliChat = require('@photon-ai/rapid/cli-chat');
var fs = require('fs');
var path = require('path');
var readline = require('readline');
var url = require('url');

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var fs__namespace = /*#__PURE__*/_interopNamespace(fs);
var path__namespace = /*#__PURE__*/_interopNamespace(path);
var readline__namespace = /*#__PURE__*/_interopNamespace(readline);

var GRPC_SERVER_ADDRESS = process.env.FLUX_SERVER_ADDRESS || "localhost:50051";
var CONFIG_DIR = path__namespace.join(process.env.HOME || "~", ".flux");
var CONFIG_FILE = path__namespace.join(CONFIG_DIR, "config.json");
var AGENT_FILE_NAME = "agent.ts";
function loadConfig() {
  try {
    if (fs__namespace.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs__namespace.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {
  }
  return {};
}
function saveConfig(config) {
  if (!fs__namespace.existsSync(CONFIG_DIR)) {
    fs__namespace.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs__namespace.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
function clearConfig() {
  if (fs__namespace.existsSync(CONFIG_FILE)) {
    fs__namespace.unlinkSync(CONFIG_FILE);
  }
}
async function prompt(question) {
  const rl = readline__namespace.createInterface({
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
    const client2 = await betterGrpc.createGrpcClient(GRPC_SERVER_ADDRESS, clientImpl);
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
  const agentPath = path__namespace.join(cwd, AGENT_FILE_NAME);
  if (fs__namespace.existsSync(agentPath)) {
    return agentPath;
  }
  const jsPath = path__namespace.join(cwd, "agent.js");
  if (fs__namespace.existsSync(jsPath)) {
    return jsPath;
  }
  return null;
}
async function validateAgentFile(agentPath) {
  try {
    const moduleUrl = url.pathToFileURL(agentPath).href;
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
  const moduleUrl = url.pathToFileURL(agentPath).href;
  const agentModule = await import(moduleUrl);
  return agentModule.default;
}
var FluxService = class extends betterGrpc.Service("FluxService") {
  sendMessage = betterGrpc.server();
  messageStream = betterGrpc.bidi();
  registerAgent = betterGrpc.server();
  unregisterAgent = betterGrpc.server();
  onIncomingMessage = betterGrpc.client();
  // Login validation - checks if user exists in Firebase
  validateUser = betterGrpc.server();
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
    this.client = await betterGrpc.createGrpcClient(GRPC_SERVER_ADDRESS, clientImpl);
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
  console.log(`[FLUX] Validating ${path__namespace.basename(agentPath)}...`);
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
  const chat = cliChat.renderChatUI();
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
  console.log(`[FLUX] Loading agent from ${path__namespace.basename(agentPath)}...`);
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

exports.FluxClient = FluxClient;
//# sourceMappingURL=cli.js.map
//# sourceMappingURL=cli.js.map