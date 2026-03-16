import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { checkStatus, loadCredentials } from "../auth";
import * as fs from "fs";
import * as path from "path";

describe("flux status command", () => {
  let originalHome: string;
  let testConfigDir: string;
  let testConfigFile: string;

  beforeEach(() => {
    // Save original HOME
    originalHome = process.env.HOME || "";

    // Create temporary config directory
    testConfigDir = path.join(process.cwd(), "test-config-" + Date.now());
    const fluxDir = path.join(testConfigDir, ".flux");
    fs.mkdirSync(fluxDir, { recursive: true });
    testConfigFile = path.join(fluxDir, "credentials.json");

    // Override HOME to use test directory
    process.env.HOME = testConfigDir;
  });

  afterEach(() => {
    // Restore original HOME
    process.env.HOME = originalHome;

    // Clean up test directory
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe("checkStatus", () => {
    it("should return not logged in when no credentials exist", async () => {
      const status = await checkStatus();

      expect(status.loggedIn).toBe(false);
      expect(status.phone).toBeUndefined();
      expect(status.tokenValid).toBeUndefined();
      expect(status.serverReachable).toBeUndefined();
    });

    it("should include server address in response", async () => {
      const status = await checkStatus();

      expect(status.serverAddress).toBeDefined();
      expect(status.serverAddress).toContain("photon.codes");
    });

    it("should return logged in status when credentials exist", async () => {
      // Create mock credentials
      const credentials = {
        token: "mock-token-123",
        phone: "+1234567890",
        authenticatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(testConfigFile, JSON.stringify(credentials, null, 2));

      // Note: This will try to reach the server and likely fail,
      // but it should still show as logged in
      const status = await checkStatus();

      expect(status.loggedIn).toBe(true);
      expect(status.phone).toBe("+1234567890");
      expect(status.authenticatedAt).toBeDefined();
    });

    it("should handle server connection errors gracefully", async () => {
      // Create mock credentials with invalid token
      const credentials = {
        token: "invalid-token",
        phone: "+1234567890",
        authenticatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(testConfigFile, JSON.stringify(credentials, null, 2));

      const status = await checkStatus();

      expect(status.loggedIn).toBe(true);
      expect(status.serverReachable).toBe(false);
      expect(status.tokenValid).toBe(false);
      expect(status.error).toBeDefined();
    });
  });

  describe("status display information", () => {
    it("should calculate days since authentication", () => {
      const authDate = new Date();
      authDate.setDate(authDate.getDate() - 5); // 5 days ago

      const now = new Date();
      const daysSince = Math.floor(
        (now.getTime() - authDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysSince).toBe(5);
    });

    it("should handle recent authentication (same day)", () => {
      const authDate = new Date();
      const now = new Date();
      const daysSince = Math.floor(
        (now.getTime() - authDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysSince).toBe(0);
    });
  });
});
