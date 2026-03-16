// src/mcp/tool-executor.ts
import { MCPClient } from './client.js';
import type { MCPServerConfig, MCPTool, ToolResult } from './types.js';

/**
 * Manages multiple MCP servers and their tools
 */
export class MCPToolExecutor {
  private clients: Map<string, MCPClient> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private serverForTool: Map<string, string> = new Map();

  /**
   * Add and connect to an MCP server
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    // Check if already connected
    if (this.clients.has(config.name)) {
      console.log(`[FLUX-MCP] Server already connected: ${config.name}`);
      return;
    }

    const client = new MCPClient(config);

    try {
      await client.connect();
      this.clients.set(config.name, client);

      // Load tools from this server
      const tools = await client.listTools();
      for (const tool of tools) {
        this.tools.set(tool.name, tool);
        this.serverForTool.set(tool.name, config.name);
      }

      console.log(`[FLUX-MCP] Loaded ${tools.length} tools from ${config.name}`);
    } catch (error) {
      console.error(`[FLUX-MCP] Failed to connect to ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Remove and disconnect from an MCP server
   */
  async removeServer(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (!client) return;

    await client.disconnect();
    this.clients.delete(serverName);

    // Remove tools from this server
    for (const [toolName, server] of this.serverForTool.entries()) {
      if (server === serverName) {
        this.tools.delete(toolName);
        this.serverForTool.delete(toolName);
      }
    }

    console.log(`[FLUX-MCP] Removed server: ${serverName}`);
  }

  /**
   * Get all available tools across all connected servers
   */
  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get a formatted description of all available tools
   */
  getToolsDescription(): string {
    const tools = this.getAvailableTools();
    if (tools.length === 0) return 'No MCP tools available.';

    const grouped = new Map<string, MCPTool[]>();
    
    for (const tool of tools) {
      const [serverName] = tool.name.split('__');
      if (!grouped.has(serverName)) {
        grouped.set(serverName, []);
      }
      grouped.get(serverName)!.push(tool);
    }

    let description = '## Available MCP Tools\n\n';
    
    for (const [serverName, serverTools] of grouped) {
      description += `### ${serverName}\n`;
      for (const tool of serverTools) {
        const shortName = tool.name.split('__')[1];
        description += `- **${shortName}**: ${tool.description}\n`;
      }
      description += '\n';
    }

    return description;
  }

  /**
   * Get tools formatted for LLM context
   */
  getToolsForLLM(): Array<{ name: string; description: string; parameters: Record<string, any> }> {
    return this.getAvailableTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    }));
  }

  /**
   * Check if a tool exists
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    const serverName = this.serverForTool.get(toolName);
    
    if (!serverName) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}. Use getAvailableTools() to see available tools.` }],
        isError: true,
      };
    }

    const client = this.clients.get(serverName);
    
    if (!client) {
      return {
        content: [{ type: 'text', text: `Server not connected: ${serverName}` }],
        isError: true,
      };
    }

    try {
      const result = await client.callTool(toolName, args);
      console.log(`[FLUX-MCP] Tool ${toolName} executed successfully`);
      return result;
    } catch (error) {
      console.error(`[FLUX-MCP] Tool ${toolName} failed:`, error);
      return {
        content: [{ type: 'text', text: `Tool execution error: ${error}` }],
        isError: true,
      };
    }
  }

  /**
   * Execute a tool and return just the text content
   */
  async executeToolSimple(toolName: string, args: Record<string, any>): Promise<string> {
    const result = await this.executeTool(toolName, args);
    
    const textContent = result.content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text)
      .join('\n');

    if (result.isError) {
      throw new Error(textContent || 'Unknown tool error');
    }

    return textContent;
  }

  /**
   * Get list of connected server names
   */
  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Check if any servers are connected
   */
  hasConnections(): boolean {
    return this.clients.size > 0;
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map(client => 
      client.disconnect().catch(err => console.error('[FLUX-MCP] Disconnect error:', err))
    );
    
    await Promise.all(disconnectPromises);
    
    this.clients.clear();
    this.tools.clear();
    this.serverForTool.clear();
    
    console.log('[FLUX-MCP] All servers disconnected');
  }
}
