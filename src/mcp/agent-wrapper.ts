// src/mcp/agent-wrapper.ts
import { MCPToolExecutor } from './tool-executor.js';
import type { MCPAgentConfig, MCPTool } from './types.js';

/**
 * Interface for Flux agent invoke parameters
 */
interface AgentInvokeParams {
  message: string;
}

/**
 * MCP-enabled Flux agent
 */
interface MCPAgent {
  /** The underlying tool executor for advanced usage */
  executor: MCPToolExecutor;
  
  /** Process a message (Flux-compatible interface) */
  invoke(params: AgentInvokeParams): Promise<string>;
  
  /** Get all available tools */
  getTools(): MCPTool[];
  
  /** Execute a specific tool */
  executeTool(name: string, args: Record<string, any>): Promise<string>;
  
  /** Clean up connections */
  cleanup(): Promise<void>;
}

/**
 * Parse tool calls from message
 * Supports formats:
 * - @tool_name({"arg": "value"})
 * - /tool_name {"arg": "value"}
 */
function parseToolCall(message: string): { toolName: string; args: Record<string, any> } | null {
  // Format: @tool_name({"arg": "value"})
  const atMatch = message.match(/@([\w_]+)\((.+)\)/s);
  if (atMatch) {
    try {
      return {
        toolName: atMatch[1],
        args: JSON.parse(atMatch[2]),
      };
    } catch {
      return null;
    }
  }

  // Format: /tool_name {"arg": "value"}
  const slashMatch = message.match(/\/([\w_]+)\s+(\{.+\})/s);
  if (slashMatch) {
    try {
      return {
        toolName: slashMatch[1],
        args: JSON.parse(slashMatch[2]),
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Create an MCP-enabled Flux agent
 * 
 * @example
 * ```typescript
 * const agent = await createMCPAgent({
 *   servers: [
 *     {
 *       name: 'filesystem',
 *       command: 'npx',
 *       args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
 *     },
 *   ],
 * });
 * 
 * export default agent;
 * ```
 */
export async function createMCPAgent(config: MCPAgentConfig): Promise<MCPAgent> {
  const executor = new MCPToolExecutor();
  const errors: string[] = [];

  console.log('[FLUX-MCP] Initializing MCP agent...');

  // Connect to all configured MCP servers
  for (const serverConfig of config.servers) {
    try {
      await executor.addServer(serverConfig);
    } catch (error) {
      const errorMsg = `Failed to connect to ${serverConfig.name}: ${error}`;
      console.error(`[FLUX-MCP] ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  const connectedCount = executor.getConnectedServers().length;
  const totalCount = config.servers.length;
  
  console.log(`[FLUX-MCP] Connected to ${connectedCount}/${totalCount} servers`);
  console.log(`[FLUX-MCP] ${executor.getAvailableTools().length} tools available`);

  // Return a Flux-compatible agent
  return {
    executor,

    getTools(): MCPTool[] {
      return executor.getAvailableTools();
    },

    async executeTool(name: string, args: Record<string, any>): Promise<string> {
      return executor.executeToolSimple(name, args);
    },

    async invoke({ message }: AgentInvokeParams): Promise<string> {
      // Check for tool call syntax
      const toolCall = parseToolCall(message);

      if (toolCall) {
        // Find the tool (support both full name and short name)
        let toolName = toolCall.toolName;
        
        // If short name, try to find matching tool
        if (!executor.hasTool(toolName)) {
          const tools = executor.getAvailableTools();
          const matchingTool = tools.find(t => 
            t.name === toolName || t.name.endsWith(`__${toolName}`)
          );
          
          if (matchingTool) {
            toolName = matchingTool.name;
          }
        }

        if (!executor.hasTool(toolName)) {
          return `❌ Unknown tool: ${toolCall.toolName}\n\n${executor.getToolsDescription()}`;
        }

        try {
          const result = await executor.executeToolSimple(toolName, toolCall.args);
          return `✅ **${toolCall.toolName}** result:\n\n${result}`;
        } catch (error) {
          return `❌ Tool error: ${error}`;
        }
      }

      // Check for help commands
      const lowerMessage = message.toLowerCase().trim();
      
      if (lowerMessage === 'help' || lowerMessage === '/help' || lowerMessage === 'tools') {
        return executor.getToolsDescription();
      }

      if (lowerMessage === 'servers' || lowerMessage === '/servers') {
        const servers = executor.getConnectedServers();
        if (servers.length === 0) {
          return '❌ No MCP servers connected.';
        }
        return `✅ Connected MCP servers:\n${servers.map(s => `- ${s}`).join('\n')}`;
      }

      // Default response with available tools
      const tools = executor.getAvailableTools();
      
      if (tools.length === 0) {
        return `No MCP tools available.\n\nReceived message: ${message}`;
      }

      // Show usage help
      return `👋 MCP Agent ready!\n\n` +
        `**Usage:**\n` +
        `- \`@tool_name({"arg": "value"})\` - Execute a tool\n` +
        `- \`help\` - Show available tools\n` +
        `- \`servers\` - Show connected servers\n\n` +
        `${executor.getToolsDescription()}`;
    },

    async cleanup(): Promise<void> {
      console.log('[FLUX-MCP] Cleaning up...');
      await executor.disconnectAll();
    },
  };
}

/**
 * Create a simple MCP agent with a single server
 */
export async function createSimpleMCPAgent(
  name: string,
  command: string,
  args: string[] = [],
  env?: Record<string, string>
): Promise<MCPAgent> {
  return createMCPAgent({
    servers: [{ name, command, args, env }],
  });
}
