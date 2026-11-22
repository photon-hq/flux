// src/mcp/index.ts
// MCP (Model Context Protocol) Integration for Flux
// Enables Flux agents to connect to any MCP server

export { MCPClient } from './client.js';
export { MCPToolExecutor } from './tool-executor.js';
export { createMCPAgent, createSimpleMCPAgent } from './agent-wrapper.js';

export type {
  MCPServerConfig,
  MCPAgentConfig,
  MCPTool,
  ToolResult,
  MCPResource,
} from './types.js';
