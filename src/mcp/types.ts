// src/mcp/types.ts
import { z } from 'zod';

/**
 * Configuration for a single MCP server
 */
export interface MCPServerConfig {
  /** Unique name for this server (used as prefix for tools) */
  name: string;
  /** Command to run the MCP server */
  command: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables for the server process */
  env?: Record<string, string>;
}

/**
 * Tool definition from an MCP server
 */
export interface MCPTool {
  /** Full tool name (serverName__toolName) */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for tool input */
  inputSchema: Record<string, any>;
}

/**
 * Configuration for creating an MCP-enabled agent
 */
export interface MCPAgentConfig {
  /** List of MCP servers to connect to */
  servers: MCPServerConfig[];
  /** Timeout for tool execution in ms (default: 30000) */
  timeout?: number;
}

/**
 * Result from executing an MCP tool
 */
export interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * Resource from an MCP server
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}
