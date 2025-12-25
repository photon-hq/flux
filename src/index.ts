// CLI entry point - routes commands and orchestrates agent execution.
import * as path from "path";
import * as readline from "readline";

import { FluxClient } from "./flux-client";
import { login, logout, loadConfig, getAuthToken } from "./auth";
import { findAgentFile, validateAgentFile, loadAgent } from "./agent-loader";

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
    console.log("[FLUX] Agent is valid!");
    return true;
  } else {
    console.error(`[FLUX] Validation failed: ${result.error}`);
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

  console.log("\n[FLUX] Welcome to Flux! Your agent is loaded.");
  console.log("[FLUX] Type a message to test it. Press Ctrl+C to exit.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question("You: ", async (input) => {
      if (!input.trim()) {
        askQuestion();
        return;
      }

      console.log("[FLUX] Thinking...");

      try {
        const response = await agent.invoke({
          message: input,
          userPhoneNumber: "+1234567890",
        });
        console.log(`Agent: ${response}\n`);
      } catch (error: any) {
        console.log(`[FLUX] Error: ${error.message}\n`);
      }

      askQuestion();
    });
  };

  rl.on("close", () => {
    console.log("\n[FLUX] Goodbye!");
    process.exit(0);
  });

  askQuestion();
}

async function runProd() {
  // Get authenticated token and phone number
  const { token, phone: phoneNumber } = await getAuthToken();

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

  const flux = new FluxClient(phoneNumber, token, async (message) => {
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

  await flux.connect();
  await flux.register();

  console.log("[FLUX] Agent running in production mode. Press Ctrl+C to stop.");
  console.log(`[FLUX] Messages to ${phoneNumber} will be processed by your agent.\n`);

  process.on("SIGINT", async () => {
    console.log("\n[FLUX] Shutting down...");
    await flux.disconnect();
    process.exit(0);
  });

  await new Promise(() => {});
}

async function main() {
  const command = process.argv[2];
  const flag = process.argv[3];

  switch (command) {
    case "login":
      await login();
      process.exit(0);
    case "logout":
      await logout();
      process.exit(0);
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
