# MCP Integration for Flux

> Connect your Flux agents to any MCP (Model Context Protocol) server

[![MCP](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io)

## What is MCP?

[Model Context Protocol (MCP)](https://modelcontextprotocol.io) is an open standard by Anthropic for connecting AI systems to external tools and data sources. With MCP, your Flux agent can:

- 📁 Read and write files
- 🔍 Search the web
- 🐙 Interact with GitHub
- 💾 Query databases
- 📝 Update Notion, Slack, and more
- ♾️ Connect to hundreds of community-built servers

## Quick Start

```typescript
// agent.ts
import { createMCPAgent } from '@photon-ai/flux/mcp';

const agent = await createMCPAgent({
  servers: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    },
  ],
});

export default agent;
```

```bash
# Run your agent
flux run --local

# Text your agent
> help
> @filesystem__read_file({"path": "README.md"})
```

## Installation

MCP support is built into Flux. Just import from `@photon-ai/flux/mcp`.

If you need to install dependencies manually:

```bash
npm install @modelcontextprotocol/sdk
```

## Available MCP Servers

### Official Servers

| Server | Package | Description |
|--------|---------|-------------|
| Filesystem | `@modelcontextprotocol/server-filesystem` | Read/write local files |
| Memory | `@modelcontextprotocol/server-memory` | Persistent key-value storage |
| Brave Search | `@modelcontextprotocol/server-brave-search` | Web search (requires API key) |
| GitHub | `@modelcontextprotocol/server-github` | GitHub API access |
| PostgreSQL | `@modelcontextprotocol/server-postgres` | Database queries |
| SQLite | `@modelcontextprotocol/server-sqlite` | SQLite database access |
| Puppeteer | `@modelcontextprotocol/server-puppeteer` | Browser automation |

### Community Servers

Find more at [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)

## Usage

### Single Server

```typescript
import { createMCPAgent } from '@photon-ai/flux/mcp';

const agent = await createMCPAgent({
  servers: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir'],
    },
  ],
});

export default agent;
```

### Multiple Servers

```typescript
import { createMCPAgent } from '@photon-ai/flux/mcp';

const agent = await createMCPAgent({
  servers: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    },
    {
      name: 'memory',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    },
    {
      name: 'github',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      },
    },
  ],
});

export default agent;
```

### Using Tools

Once connected, your agent has access to all tools from the MCP servers.

**Via iMessage:**
```
@filesystem__read_file({"path": "README.md"})
@filesystem__list_directory({"path": "."})
@memory__store({"key": "note", "value": "Remember this!"})
@memory__retrieve({"key": "note"})
```

**Commands:**
- `help` - Show all available tools
- `servers` - Show connected servers

### Advanced: Direct Tool Execution

```typescript
const agent = await createMCPAgent({ servers: [...] });

// Get all tools
const tools = agent.getTools();
console.log(tools);

// Execute a tool directly
const content = await agent.executeTool('filesystem__read_file', { 
  path: 'package.json' 
});
console.log(content);

// Access the underlying executor
const executor = agent.executor;
const result = await executor.executeTool('filesystem__write_file', {
  path: 'output.txt',
  content: 'Hello from MCP!',
});
```

### Cleanup

Always clean up when your agent is done:

```typescript
const agent = await createMCPAgent({ servers: [...] });

// When done
await agent.cleanup();
```

Or handle process signals:

```typescript
process.on('SIGINT', async () => {
  await agent.cleanup();
  process.exit(0);
});
```

## Configuration

### MCPServerConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Unique name for the server (used as tool prefix) |
| `command` | string | Yes | Command to run the MCP server |
| `args` | string[] | No | Arguments for the command |
| `env` | Record<string, string> | No | Environment variables |

### MCPAgentConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `servers` | MCPServerConfig[] | Yes | List of MCP servers to connect |
| `timeout` | number | No | Tool execution timeout in ms (default: 30000) |

## Examples

### Filesystem Agent

```typescript
// Access files via iMessage
import { createMCPAgent } from '@photon-ai/flux/mcp';

const agent = await createMCPAgent({
  servers: [
    {
      name: 'fs',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user/documents'],
    },
  ],
});

export default agent;
```

### Research Agent

```typescript
// Web search + file storage
import { createMCPAgent } from '@photon-ai/flux/mcp';

const agent = await createMCPAgent({
  servers: [
    {
      name: 'search',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY },
    },
    {
      name: 'files',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', './research'],
    },
  ],
});

export default agent;
```

### Database Agent

```typescript
// Query PostgreSQL via iMessage
import { createMCPAgent } from '@photon-ai/flux/mcp';

const agent = await createMCPAgent({
  servers: [
    {
      name: 'db',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      env: {
        POSTGRES_HOST: 'localhost',
        POSTGRES_DB: 'myapp',
        POSTGRES_USER: 'user',
        POSTGRES_PASSWORD: process.env.DB_PASSWORD,
      },
    },
  ],
});

export default agent;
```

## Error Handling

The MCP integration handles errors gracefully:

- If a server fails to connect, other servers still work
- Tool execution errors return error messages instead of crashing
- Disconnection is handled safely

```typescript
const agent = await createMCPAgent({
  servers: [
    { name: 'server1', command: 'valid-command' },
    { name: 'server2', command: 'invalid-command' }, // Will fail but won't crash
  ],
});

// server1 tools will still be available
```

## API Reference

### createMCPAgent(config)

Creates a Flux-compatible agent with MCP capabilities.

**Parameters:**
- `config`: MCPAgentConfig

**Returns:** Promise<MCPAgent>

### MCPAgent

| Method | Description |
|--------|-------------|
| `invoke({ message })` | Process a message (Flux interface) |
| `getTools()` | Get all available MCP tools |
| `executeTool(name, args)` | Execute a specific tool |
| `cleanup()` | Disconnect all servers |
| `executor` | Access underlying MCPToolExecutor |

### MCPToolExecutor

| Method | Description |
|--------|-------------|
| `addServer(config)` | Connect to an MCP server |
| `removeServer(name)` | Disconnect from a server |
| `getAvailableTools()` | Get all tools |
| `executeTool(name, args)` | Execute a tool |
| `disconnectAll()` | Disconnect all servers |

## Resources

- [MCP Documentation](https://modelcontextprotocol.io)
- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Flux Documentation](https://photon.codes)

## Contributing

Found a bug or have an idea? Open an issue or PR!

---

Built with ⚡ by the Flux community
