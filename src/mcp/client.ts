// src/mcp/client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPServerConfig, MCPTool, ToolResult, MCPResource } from './types.js';

/**
 * MCP Client wrapper for connecting to a single MCP server
 */
export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private connected: boolean = false;
  private config: MCPServerConfig;
  public readonly serverName: string;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.serverName = config.name;

    this.client = new Client({
      name: `flux-mcp-client-${config.name}`,
      version: '1.0.0',
    });
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args || [],
      env: { ...process.env, ...this.config.env },
    });

    await this.client.connect(this.transport);
    this.connected = true;
    console.log(`[FLUX-MCP] ✓ Connected to server: ${this.serverName}`);
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.close();
    } catch (error) {
      // Ignore close errors
    }
    
    this.connected = false;
    console.log(`[FLUX-MCP] ✗ Disconnected from server: ${this.serverName}`);
  }

  /**
   * Check if connected to the server
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * List all tools available from this server
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.connected) {
      throw new Error(`MCP client not connected: ${this.serverName}`);
    }

    const response = await this.client.listTools();

    return response.tools.map(tool => ({
      // Prefix tool name with server name to avoid conflicts
      name: `${this.serverName}__${tool.name}`,
      description: tool.description || `Tool from ${this.serverName}`,
      inputSchema: tool.inputSchema as Record<string, any>,
    }));
  }

  /**
   * Execute a tool on this server
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    if (!this.connected) {
      throw new Error(`MCP client not connected: ${this.serverName}`);
    }

    // Remove server prefix from tool name if present
    const actualToolName = toolName.startsWith(`${this.serverName}__`)
      ? toolName.replace(`${this.serverName}__`, '')
      : toolName;

    console.log(`[FLUX-MCP] Executing tool: ${actualToolName} on ${this.serverName}`);

    const result = await this.client.callTool({
      name: actualToolName,
      arguments: args,
    });

    return {
      content: result.content as ToolResult['content'],
      isError: result.isError,
    };
  }

  /**
   * List all resources available from this server
   */
  async listResources(): Promise<MCPResource[]> {
    if (!this.connected) {
      throw new Error(`MCP client not connected: ${this.serverName}`);
    }

    const response = await this.client.listResources();
    
    return response.resources.map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    }));
  }

  /**
   * Read a specific resource from this server
   */
  async readResource(uri: string): Promise<any> {
    if (!this.connected) {
      throw new Error(`MCP client not connected: ${this.serverName}`);
    }

    return await this.client.readResource({ uri });
  }
}
