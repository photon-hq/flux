// examples/mcp/filesystem-agent.ts
// 
// Flux agent with filesystem access via MCP
// Text your agent to read/write files on your machine!
//
// Usage:
//   1. flux run --local
//   2. Text: @filesystem__read_file({"path": "README.md"})
//   3. Text: @filesystem__list_directory({"path": "."})

import { createMCPAgent } from '../../src/mcp/index.js';

const agent = await createMCPAgent({
  servers: [
    {
      name: 'filesystem',
      command: 'npx',
      args: [
        '-y',
        '@modelcontextprotocol/server-filesystem',
        // Change this to the directory you want to access
        process.cwd(),
      ],
    },
  ],
});

// Clean up on exit
process.on('SIGINT', async () => {
  await agent.cleanup();
  process.exit(0);
});

export default agent;
