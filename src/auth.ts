// Handles user authentication via iMessage verification, config persistence, and login/logout commands.
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { exec } from "child_process";
import { createGrpcClient } from "better-grpc";
import { FluxService } from "./service";

const GRPC_SERVER_ADDRESS = process.env.FLUX_SERVER_ADDRESS || "fluxy.photon.codes:443";
const CONFIG_DIR = path.join(process.env.HOME || "~", ".flux");
const CONFIG_FILE = path.join(CONFIG_DIR, "credentials.json");
const VERIFICATION_NUMBER = "+16286298650"; // Flux iMessage number for verification

interface FluxCredentials {
  token?: string;
  phone?: string;
  authenticatedAt?: string;
}

export function loadCredentials(): FluxCredentials {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveCredentials(credentials: FluxCredentials): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(credentials, null, 2));
}

function clearCredentials(): void {
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

function openIMessage(to: string, body: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `sms:${to}&body=${encodeURIComponent(body)}`;
    const command = process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
      ? `start "" "${url}"`
      : `xdg-open "${url}"`;

    exec(command, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function createGrpcClientWithRetry() {
  const clientImpl = FluxService.Client({
    async onIncomingMessage() {
      return { received: true };
    },
  });
  return await createGrpcClient(GRPC_SERVER_ADDRESS, clientImpl);
}

export async function login(): Promise<string> {
  // Check if already logged in with valid token
  const existing = loadCredentials();
  if (existing.token) {
    try {
      const client = await createGrpcClientWithRetry();
      const result = await client.FluxService.validateToken(existing.token);
      if (result.valid) {
        console.log(`[FLUX] Already logged in as ${result.phone}`);
        return result.phone;
      }
    } catch {
      // Token validation failed, proceed with new login
    }
    clearCredentials();
  }

  // Prompt for phone number
  const phoneNumber = await prompt("Enter your phone number (e.g. +15551234567): ");
  if (!phoneNumber.match(/^\+?[0-9]{10,15}$/)) {
    console.error("[FLUX] Invalid phone number format.");
    process.exit(1);
  }

  // Normalize phone number (ensure it starts with +)
  const normalizedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;

  console.log("[FLUX] Requesting verification code...");

  try {
    const client = await createGrpcClientWithRetry();
    const clientId = crypto.randomUUID();

    // Step 1: Request a dynamic verification code
    const codeResult = await client.FluxService.getDynamicCode(clientId, normalizedPhone);

    if (codeResult.error) {
      console.error(`[FLUX] Failed to get verification code: ${codeResult.error}`);
      process.exit(1);
    }

    const code = codeResult.code;
    console.log(`[FLUX] Verification code: ${code}`);
    console.log(`[FLUX] Opening iMessage to send verification code...`);

    // Step 2: Open iMessage with pre-filled code
    try {
      await openIMessage(VERIFICATION_NUMBER, code);
      console.log(`[FLUX] Please send the code "${code}" to ${VERIFICATION_NUMBER} via iMessage.`);
    } catch {
      console.log(`[FLUX] Could not open iMessage automatically.`);
      console.log(`[FLUX] Please manually send "${code}" to ${VERIFICATION_NUMBER} via iMessage.`);
    }

    console.log("[FLUX] Waiting for verification...");

    // Step 3: Wait for server to verify the iMessage was received
    const verifyResult = await client.FluxService.waitingVerified(clientId);

    if (verifyResult.error || !verifyResult.token) {
      console.error(`[FLUX] Verification failed: ${verifyResult.error || "No token received"}`);
      process.exit(1);
    }

    // Step 4: Save credentials locally
    const credentials: FluxCredentials = {
      token: verifyResult.token,
      phone: normalizedPhone,
      authenticatedAt: new Date().toISOString(),
    };
    saveCredentials(credentials);

    console.log(`[FLUX] Successfully logged in as ${normalizedPhone}`);
    return normalizedPhone;

  } catch (error: any) {
    console.error(`[FLUX] Failed to connect to server: ${error.message}`);
    console.error(`[FLUX] Make sure the Flux server is running at ${GRPC_SERVER_ADDRESS}`);
    process.exit(1);
  }
}

export async function logout(): Promise<void> {
  const credentials = loadCredentials();

  if (credentials.token) {
    try {
      const client = await createGrpcClientWithRetry();
      await client.FluxService.revokeToken(credentials.token);
    } catch {
      // Server revocation failed, but still clear local credentials
    }
  }

  clearCredentials();
  console.log("[FLUX] Logged out.");
}

export async function getAuthToken(): Promise<{ token: string; phone: string }> {
  const credentials = loadCredentials();

  if (credentials.token && credentials.phone) {
    // Validate the token is still valid
    try {
      const client = await createGrpcClientWithRetry();
      const result = await client.FluxService.validateToken(credentials.token);

      if (result.valid) {
        return { token: credentials.token, phone: result.phone };
      }
    } catch {
      // Token validation failed
    }

    // Token is invalid, clear and re-login
    console.log("[FLUX] Session expired. Please log in again.");
    clearCredentials();
  }

  console.log("[FLUX] Not logged in.");
  const phone = await login();
  const newCredentials = loadCredentials();

  if (!newCredentials.token) {
    console.error("[FLUX] Login failed.");
    process.exit(1);
  }

  return { token: newCredentials.token, phone };
}

// Legacy function for backwards compatibility
export async function getPhoneNumber(): Promise<string> {
  const { phone } = await getAuthToken();
  return phone;
}

// Legacy function for backwards compatibility
export function loadConfig(): { phoneNumber?: string } {
  const credentials = loadCredentials();
  return { phoneNumber: credentials.phone };
}
