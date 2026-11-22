// examples/mcp/multi-server-agent.ts
//
// Flux agent with multiple MCP capabilities
// Combines filesystem access with persistent memory
//
// Usage:
//   1. flux run --local
//   2. Text: help (to see all available tools)
//   3. Text: @memory__store({"key": "name", "value": "John"})
//   4. Text: @memory__retrieve({"key": "name"})
//   5. Text: @filesystem__read_file({"path": "package.json"})

import { createMCPAgent } from '../../src/mcp/index.js';

const agent = await createMCPAgent({
  servers: [
    // Filesystem server - read/write local files
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
    },
    // Memory server - persistent key-value storage
    {
      name: 'memory',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    },
  ],
});

// Clean up on exit
process.on('SIGINT', async () => {
  await agent.cleanup();
  process.exit(0);
});

export default agent;
