// Handles discovery, validation, and dynamic loading of user agent files.
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { FluxAgent } from "./agent-type";

const AGENT_FILE_NAME = "agent.ts";

export function findAgentFile(): string | null {
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

export async function validateAgentFile(agentPath: string): Promise<{ valid: boolean; error?: string }> {
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

export async function loadAgent(agentPath: string): Promise<FluxAgent> {
  const moduleUrl = pathToFileURL(agentPath).href;
  const agentModule = await import(moduleUrl);
  return agentModule.default as FluxAgent;
}
