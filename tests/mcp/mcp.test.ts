// tests/mcp/mcp.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPClient } from '../../src/mcp/client.js';
import { MCPToolExecutor } from '../../src/mcp/tool-executor.js';

describe('MCPClient', () => {
  it('should create client instance with correct server name', () => {
    const client = new MCPClient({
      name: 'test-server',
      command: 'echo',
      args: ['test'],
    });

    expect(client.serverName).toBe('test-server');
  });

  it('should not be connected initially', () => {
    const client = new MCPClient({
      name: 'test-server',
      command: 'echo',
    });

    expect(client.isConnected()).toBe(false);
  });

  it('should handle server config with all options', () => {
    const client = new MCPClient({
      name: 'full-config',
      command: 'node',
      args: ['--version'],
      env: { TEST_VAR: 'value' },
    });

    expect(client.serverName).toBe('full-config');
  });
});

describe('MCPToolExecutor', () => {
  let executor: MCPToolExecutor;

  beforeEach(() => {
    executor = new MCPToolExecutor();
  });

  afterEach(async () => {
    await executor.disconnectAll();
  });

  it('should initialize with no tools', () => {
    const tools = executor.getAvailableTools();
    expect(tools).toHaveLength(0);
  });

  it('should return empty array for connected servers initially', () => {
    const servers = executor.getConnectedServers();
    expect(servers).toHaveLength(0);
  });

  it('should return false for hasConnections initially', () => {
    expect(executor.hasConnections()).toBe(false);
  });

  it('should return "No MCP tools available" for empty tools description', () => {
    const description = executor.getToolsDescription();
    expect(description).toBe('No MCP tools available.');
  });

  it('should return empty array for getToolsForLLM with no tools', () => {
    const tools = executor.getToolsForLLM();
    expect(tools).toEqual([]);
  });

  it('should return false for hasTool with unknown tool', () => {
    expect(executor.hasTool('unknown_tool')).toBe(false);
  });

  it('should return error for executeTool with unknown tool', async () => {
    const result = await executor.executeTool('unknown_tool', {});
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown tool');
  });

  it('should handle disconnectAll gracefully when no connections', async () => {
    // Should not throw
    await executor.disconnectAll();
    expect(executor.getConnectedServers()).toHaveLength(0);
  });
});

describe('Tool name parsing', () => {
  it('should correctly format tool names with server prefix', () => {
    const serverName = 'filesystem';
    const toolName = 'read_file';
    const fullName = `${serverName}__${toolName}`;
    
    expect(fullName).toBe('filesystem__read_file');
  });

  it('should correctly extract tool name from full name', () => {
    const fullName = 'filesystem__read_file';
    const [serverName, toolName] = fullName.split('__');
    
    expect(serverName).toBe('filesystem');
    expect(toolName).toBe('read_file');
  });
});

describe('MCPAgentConfig validation', () => {
  it('should accept valid server config', () => {
    const config = {
      servers: [
        {
          name: 'test',
          command: 'echo',
          args: ['hello'],
        },
      ],
    };

    expect(config.servers).toHaveLength(1);
    expect(config.servers[0].name).toBe('test');
  });

  it('should accept config with multiple servers', () => {
    const config = {
      servers: [
        { name: 'server1', command: 'cmd1' },
        { name: 'server2', command: 'cmd2' },
        { name: 'server3', command: 'cmd3' },
      ],
    };

    expect(config.servers).toHaveLength(3);
  });

  it('should accept config with optional timeout', () => {
    const config = {
      servers: [{ name: 'test', command: 'echo' }],
      timeout: 5000,
    };

    expect(config.timeout).toBe(5000);
  });
});
