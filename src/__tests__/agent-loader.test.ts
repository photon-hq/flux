import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import { findAgentFile, validateAgentFile, loadAgent } from "../agent-loader";

describe("agent-loader", () => {
  let originalCwd: string;
  let testDir: string;

  beforeEach(() => {
    // Save original working directory
    originalCwd = process.cwd();

    // Create a temporary test directory
    testDir = path.join(process.cwd(), "test-temp-" + Date.now());
    fs.mkdirSync(testDir, { recursive: true });

    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(() => {
    // Restore original working directory
    process.chdir(originalCwd);

    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("findAgentFile", () => {
    it("should return null when no agent file exists", () => {
      const result = findAgentFile();
      expect(result).toBeNull();
    });

    it("should find agent.ts in current directory", () => {
      // Create agent.ts
      const agentPath = path.join(testDir, "agent.ts");
      fs.writeFileSync(agentPath, "export default { invoke: async () => 'test' };");

      const result = findAgentFile();
      expect(result).toBe(agentPath);
    });

    it("should find agent.js in current directory", () => {
      // Create agent.js
      const agentPath = path.join(testDir, "agent.js");
      fs.writeFileSync(agentPath, "export default { invoke: async () => 'test' };");

      const result = findAgentFile();
      expect(result).toBe(agentPath);
    });

    it("should prefer agent.ts over agent.js when both exist", () => {
      // Create both files
      const tsPath = path.join(testDir, "agent.ts");
      const jsPath = path.join(testDir, "agent.js");
      fs.writeFileSync(tsPath, "export default { invoke: async () => 'ts' };");
      fs.writeFileSync(jsPath, "export default { invoke: async () => 'js' };");

      const result = findAgentFile();
      expect(result).toBe(tsPath);
    });
  });

  describe("validateAgentFile", () => {
    it("should validate a correct TypeScript agent file", async () => {
      const fixtureDir = path.join(originalCwd, "src", "__tests__", "fixtures");
      const agentPath = path.join(fixtureDir, "valid-agent.ts");

      const result = await validateAgentFile(agentPath);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should validate a correct JavaScript agent file", async () => {
      const fixtureDir = path.join(originalCwd, "src", "__tests__", "fixtures");
      const agentPath = path.join(fixtureDir, "valid-agent.js");

      const result = await validateAgentFile(agentPath);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject agent without default export", async () => {
      const fixtureDir = path.join(originalCwd, "src", "__tests__", "fixtures");
      const agentPath = path.join(fixtureDir, "no-default-export.ts");

      const result = await validateAgentFile(agentPath);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("No default export found. Use `export default agent`");
    });

    it("should reject agent without invoke method", async () => {
      const fixtureDir = path.join(originalCwd, "src", "__tests__", "fixtures");
      const agentPath = path.join(fixtureDir, "no-invoke-method.ts");

      const result = await validateAgentFile(agentPath);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Agent must have an `invoke` method");
    });

    it("should reject agent where invoke is not a function", async () => {
      const fixtureDir = path.join(originalCwd, "src", "__tests__", "fixtures");
      const agentPath = path.join(fixtureDir, "invoke-not-function.ts");

      const result = await validateAgentFile(agentPath);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Agent must have an `invoke` method");
    });

    it("should handle invalid syntax gracefully", async () => {
      const fixtureDir = path.join(originalCwd, "src", "__tests__", "fixtures");
      const agentPath = path.join(fixtureDir, "invalid-syntax.ts");

      const result = await validateAgentFile(agentPath);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Failed to load agent:/);
    });

    it("should handle non-existent file", async () => {
      const agentPath = path.join(testDir, "non-existent.ts");

      const result = await validateAgentFile(agentPath);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Failed to load agent:/);
    });

    it("should handle empty file", async () => {
      const agentPath = path.join(testDir, "empty.ts");
      fs.writeFileSync(agentPath, "");

      const result = await validateAgentFile(agentPath);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("No default export found. Use `export default agent`");
    });
  });

  describe("loadAgent", () => {
    it("should successfully load a valid TypeScript agent", async () => {
      const fixtureDir = path.join(originalCwd, "src", "__tests__", "fixtures");
      const agentPath = path.join(fixtureDir, "valid-agent.ts");

      const agent = await loadAgent(agentPath);

      expect(agent).toBeDefined();
      expect(typeof agent.invoke).toBe("function");
    });

    it("should successfully load a valid JavaScript agent", async () => {
      const fixtureDir = path.join(originalCwd, "src", "__tests__", "fixtures");
      const agentPath = path.join(fixtureDir, "valid-agent.js");

      const agent = await loadAgent(agentPath);

      expect(agent).toBeDefined();
      expect(typeof agent.invoke).toBe("function");
    });

    it("should load agent that can be invoked", async () => {
      const fixtureDir = path.join(originalCwd, "src", "__tests__", "fixtures");
      const agentPath = path.join(fixtureDir, "valid-agent.ts");

      const agent = await loadAgent(agentPath);
      const response = await agent.invoke({
        message: "Hello",
        userPhoneNumber: "+1234567890"
      });

      expect(response).toBe("Echo: Hello from +1234567890");
    });

    it("should handle TypeScript features in agent", async () => {
      // Create an agent with TypeScript features
      const agentPath = path.join(testDir, "ts-features.ts");
      fs.writeFileSync(agentPath, `
        interface InvokeInput {
          message: string;
          userPhoneNumber: string;
        }

        export default {
          async invoke({ message, userPhoneNumber }: InvokeInput): Promise<string> {
            const greeting: string = "Hello";
            return \`\${greeting}: \${message}\`;
          }
        };
      `);

      const agent = await loadAgent(agentPath);
      const response = await agent.invoke({
        message: "World",
        userPhoneNumber: "+1234567890"
      });

      expect(response).toBe("Hello: World");
    });
  });

  describe("Integration tests", () => {
    it("should find, validate, and load an agent in workflow", async () => {
      // Create a valid agent in test directory
      const agentContent = `
        export default {
          async invoke({ message }: { message: string }) {
            return \`You said: \${message}\`;
          }
        };
      `;
      fs.writeFileSync(path.join(testDir, "agent.ts"), agentContent);

      // Step 1: Find the agent
      const foundPath = findAgentFile();
      expect(foundPath).not.toBeNull();

      // Step 2: Validate the agent
      const validation = await validateAgentFile(foundPath!);
      expect(validation.valid).toBe(true);

      // Step 3: Load the agent
      const agent = await loadAgent(foundPath!);
      expect(agent).toBeDefined();

      // Step 4: Use the agent
      const response = await agent.invoke({ message: "test" });
      expect(response).toBe("You said: test");
    });

    it("should handle workflow with invalid agent", async () => {
      // Create an invalid agent (missing invoke method)
      const invalidContent = `
        export default {
          // Missing invoke method - has 'run' instead
          async run({ message }: { message: string }) {
            return message;
          }
        };
      `;
      fs.writeFileSync(path.join(testDir, "agent.ts"), invalidContent);

      // Find the agent
      const foundPath = findAgentFile();
      expect(foundPath).not.toBeNull();

      // Validate should fail (no invoke method)
      const validation = await validateAgentFile(foundPath!);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain("invoke");
    });
  });
});
