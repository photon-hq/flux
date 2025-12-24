<div align="center">

![Banner](./assets/banner.png)

# @photon-ai/flux

> A new way to build and deploy your iMessage agents at the speed of light

</div>

[![npm version](https://img.shields.io/npm/v/@photon-ai/flux.svg)](https://www.npmjs.com/package/@photon-ai/flux)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/bZd4CMd2H5)

Build iMessage agents with just Python. Write your agent logic via LangChain, and Flux handles the rest, from routing, sessions, tool execution, and deployment.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `npx @photon-cli/flux` | Show help |
| `npx @photon-cli/flux whoami` | Check account |
| `npx @photon-cli/flux login` | Login and signup|
| `npx @photon-cli/flux logout` | Logout |
| `npx @photon-cli/flux run --local` | Start the development server (local mode) |
| `npx @photon-cli/flux run --prod` | Start with live iMessage bridge |
| `npx @photon-cli/flux validate` | Check your code for errors |

---

## Installation

```
npm install @photon-cli/flux
bun add @photon-cli/flux
```

---

## Testing

### 1. Validate the agent (run from your project directory)
bun /Users/garygao/flux/src/cli.ts validate

## 2. Test locally (interactive mode - no server needed)
bun /Users/garygao/flux/src/cli.ts run --local

### 3. Login and run connected to bridge
bun /Users/garygao/flux/src/cli.ts login
bun /Users/garygao/flux/src/cli.ts run --prod

---
## Requirements

- **Node.js** 18+ (for the CLI)
- **Python** 3.9+ (for the agent)
- **LLM Keys (e.g. OpenAI API key)**

---


<div align="center">
  <sub>Built with ⚡ by <a href="https://photon.codes">Photon</a></sub>
</div>