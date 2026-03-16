// examples/mcp/research-agent.ts
//
// Flux agent for research - web search + file storage
// Search the web and save findings to files
//
// Prerequisites:
//   - Get a Brave Search API key from https://brave.com/search/api/
//   - Set BRAVE_API_KEY environment variable
//
// Usage:
//   1. export BRAVE_API_KEY=your_api_key
//   2. flux run --local
//   3. Text: @brave-search__web_search({"query": "latest AI news"})
//   4. Text: @filesystem__write_file({"path": "research.txt", "content": "..."})

import { createMCPAgent } from '../../src/mcp/index.js';

// Ensure research directory exists
import { mkdirSync } from 'fs';
const researchDir = './research';
try {
  mkdirSync(researchDir, { recursive: true });
} catch {
  // Directory already exists
}

const agent = await createMCPAgent({
  servers: [
    // Brave Search - web search capability
    {
      name: 'brave-search',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: {
        BRAVE_API_KEY: process.env.BRAVE_API_KEY || '',
      },
    },
    // Filesystem - save research results
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', researchDir],
    },
  ],
});

// Warn if API key is missing
if (!process.env.BRAVE_API_KEY) {
  console.warn('[WARNING] BRAVE_API_KEY not set. Web search will not work.');
  console.warn('Get your API key at: https://brave.com/search/api/');
}

// Clean up on exit
process.on('SIGINT', async () => {
  await agent.cleanup();
  process.exit(0);
});

export default agent;
