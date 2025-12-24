// Handles user authentication, config persistence, and login/logout commands.
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { createGrpcClient } from "better-grpc";
import { FluxService } from "./service";

const GRPC_SERVER_ADDRESS = process.env.FLUX_SERVER_ADDRESS || "fluxy.photon.codes:443";
const CONFIG_DIR = path.join(process.env.HOME || "~", ".flux");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

interface FluxConfig {
  phoneNumber?: string;
}

export function loadConfig(): FluxConfig {
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

export async function login(): Promise<string> {
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

export function logout(): void {
  clearConfig();
  console.log("[FLUX] Logged out.");
}

export async function getPhoneNumber(): Promise<string> {
  const config = loadConfig();
  if (config.phoneNumber) {
    return config.phoneNumber;
  }
  console.log("[FLUX] Not logged in.");
  return await login();
}
