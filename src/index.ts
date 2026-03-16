// CLI entry point - routes commands and orchestrates agent execution.
import * as path from "path";
import * as readline from "readline";

import { FluxClient } from "./flux-client";
import { login, logout, loadConfig, getAuthToken, checkStatus } from "./auth";
import { findAgentFile, validateAgentFile, loadAgent } from "./agent-loader";
import { memory } from "./memory";

function splitIntoMessages(response: string): string[] {
  if (!response.includes('\n')) {
    return [response];
  }

  const parts = response.split('\n').map(p => p.trim()).filter(p => p);
  return parts.length > 0 ? parts : [response];
}

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

  // Initialize agent (no sendMessage in local mode)
  if (agent.onInit) {
    await agent.onInit();
  }

  console.log("\n[FLUX] Welcome to Flux! Your agent is loaded.");
  console.log("[FLUX] Type a message to test it. Press Ctrl+C to exit.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const localPhoneNumber = "+1234567890";

  const askQuestion = () => {
    rl.question("You: ", async (input) => {
      if (!input.trim()) {
        askQuestion();
        return;
      }

      // Add user message to memory
      memory.add(localPhoneNumber, {
        role: "user",
        content: input,
        timestamp: Date.now(),
      });

      console.log("[FLUX] Thinking...");

      try {
        const response = await agent.invoke({
          message: input,
          userPhoneNumber: localPhoneNumber,
          history: memory.get(localPhoneNumber),
        });

        // Add assistant response to memory
        memory.add(localPhoneNumber, {
          role: "assistant",
          content: response,
          timestamp: Date.now(),
        });

        const messages = splitIntoMessages(response);
        for (const msg of messages) {
          console.log(`Agent: ${msg}`);
        }
        console.log();
      } catch (error: any) {
        console.log(`[FLUX] Error: ${error.message}\n`);
        if (agent.onError) {
          await agent.onError(error);
        }
      }

      askQuestion();
    });
  };

  rl.on("close", async () => {
    console.log("\n[FLUX] Goodbye!");
    if (agent.onShutdown) {
      await agent.onShutdown();
    }
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

    // Add user message to memory
    memory.add(message.userPhoneNumber, {
      role: "user",
      content: message.text,
      timestamp: Date.now(),
      imageBase64: message.imageBase64,
    });

    try {
      const response = await agent.invoke({
        message: message.text,
        userPhoneNumber: message.userPhoneNumber,
        messageGuid: message.messageGuid,
        imageBase64: message.imageBase64,
        history: memory.get(message.userPhoneNumber),
      });

      // Add assistant response to memory
      memory.add(message.userPhoneNumber, {
        role: "assistant",
        content: response,
        timestamp: Date.now(),
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

  // Initialize agent with sendMessage and sendTapback for proactive messaging
  if (agent.onInit) {
    console.log("[FLUX] Initializing agent with proactive messaging support...");
    await agent.onInit(
      async (to: string, text: string) => {
        const messages = splitIntoMessages(text);
        for (const msg of messages) {
          const success = await flux.sendMessage(to, msg);
          if (!success) return false;
        }
        return true;
      },
      async (messageGuid: string, reaction: string, chat: string) => {
        return flux.sendTapback(messageGuid, reaction as any, chat);
      }
    );
  }

  console.log("[FLUX] Agent running in production mode. Press Ctrl+C to stop.");
  console.log(`[FLUX] Messages to ${phoneNumber} will be processed by your agent.\n`);

  process.on("SIGINT", async () => {
    console.log("\n[FLUX] Shutting down...");
    if (agent.onShutdown) {
      await agent.onShutdown();
    }
    await flux.disconnect();
    process.exit(0);
  });

  await new Promise(() => {});
}

async function statusCommand() {
  console.log("[FLUX] Checking status...\n");

  const status = await checkStatus();

  // Display status information
  console.log("═══════════════════════════════════════");
  console.log("           FLUX STATUS REPORT          ");
  console.log("═══════════════════════════════════════\n");

  // Login status
  if (status.loggedIn) {
    console.log("✅ Authentication:    Logged in");
    console.log(`📱 Phone Number:      ${status.phone}`);

    if (status.authenticatedAt) {
      const authDate = new Date(status.authenticatedAt);
      const now = new Date();
      const daysSince = Math.floor((now.getTime() - authDate.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`📅 Authenticated:     ${authDate.toLocaleString()}`);
      console.log(`⏱️  Time Since Login:  ${daysSince} day(s) ago`);
    }
  } else {
    console.log("❌ Authentication:    Not logged in");
    console.log("💡 Hint:              Run 'flux login' to authenticate");
  }

  console.log();

  // Server connectivity
  if (status.serverReachable === true) {
    console.log("✅ Server:            Connected");
    console.log(`🌐 Server Address:    ${status.serverAddress}`);
  } else if (status.serverReachable === false) {
    console.log("❌ Server:            Unreachable");
    console.log(`🌐 Server Address:    ${status.serverAddress}`);
    if (status.error) {
      console.log(`⚠️  Error:             ${status.error}`);
    }
  } else {
    console.log("⏸️  Server:            Not checked (no credentials)");
    console.log(`🌐 Server Address:    ${status.serverAddress}`);
  }

  console.log();

  // Token validity
  if (status.tokenValid === true) {
    console.log("✅ Token:             Valid");
    console.log("🔐 Status:            Ready to run agents");
  } else if (status.tokenValid === false) {
    console.log("❌ Token:             Invalid or expired");
    console.log("💡 Hint:              Run 'flux login' to refresh");
  } else {
    console.log("⏸️  Token:             No token found");
  }

  console.log();
  console.log("═══════════════════════════════════════\n");

  // Summary and next steps
  if (status.loggedIn && status.tokenValid && status.serverReachable) {
    console.log("🎉 All systems operational! You're ready to deploy agents.");
    console.log("   Run 'flux run --prod' to start your agent.\n");
  } else if (!status.loggedIn) {
    console.log("⚠️  Please log in to use Flux.");
    console.log("   Run 'flux login' to get started.\n");
  } else if (!status.serverReachable) {
    console.log("⚠️  Cannot reach Flux server.");
    console.log("   Check your internet connection or try again later.\n");
  } else if (!status.tokenValid) {
    console.log("⚠️  Your session has expired.");
    console.log("   Run 'flux login' to refresh your authentication.\n");
  }
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
    case "status":
      await statusCommand();
      break;
    default:
      console.log("Flux CLI - Connect LangChain agents to iMessage\n");
      console.log("Commands:");
      console.log("  flux login          - Log in with your phone number");
      console.log("  flux logout         - Log out");
      console.log("  flux status         - Check server connectivity and auth status");
      console.log("  flux validate       - Check if agent.ts exports correctly");
      console.log("  flux run --local    - Test agent locally (no server connection)");
      console.log("  flux run --prod     - Run agent connected to bridge (default)");
      console.log("  flux whoami         - Show current logged in user");
      break;
  }
}

main().catch(console.error);
