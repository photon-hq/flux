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

Flux is an open-sourced CLI tool that lets developers build and deploy LangChain agents that connect to iMessage at no cost and under 5 seconds. 

---

## Features

- **Deploy with a single command**: Export a LangChain agent and deploy it to iMessage with a single command. 
- **Text your agent from your phone**: Send an iMessage to the Flux number and get responses from your running agent. 
- **Testing mode**: Test your agent through your terminal before connecting to the iMessage brigde. 
- **Phone Number Authentication**: Log in with just your phone number and iMessage. 
- **Agent Validation**: Automatically validate your LangChain agent in the CLI. 

---

## Installation

```
npm install @photon-ai/flux
bun add @photon-ai/flux
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `npx @photon-ai/flux` | Show help |
| `npx @photon-ai/flux whoami` | Check account |
| `npx @photon-ai/flux login` | Login and signup|
| `npx @photon-ai/flux logout` | Logout |
| `npx @photon-ai/flux run --local` | Start the development server (local mode) |
| `npx @photon-ai/flux run --prod` | Start with live iMessage bridge |
| `npx @photon-ai/flux validate` | Check your code for errors |

---

## Flux Number

Message +16286298650 with you phone number to text the LangChain agent that you built. 

---

## Log in

Authentication is based on iMessage: 
- The user (client) sends a code to the Flux number to prove phone ownership. 
- The server generates a UUID per login attempt. It then waits for the iMessage text from the client with the UUID. Once verified, it will issue a token. 
- Credentials (token, phone, timestamp) are saved to credentials.json. This way, the user only has to log in once. 

---

## Usage 

#### Step 1: Create LangChain Agent

Create agent.ts file with your LangChain agent: 

```
// agent.ts
export default {
  async invoke({ message }: { message: string }) {
    return `You said: ${message}`;
  }
};
```

### Step 2: Login

Authenticate with your phone number and iMessage: 

```
npx @photon-ai/flux login

Enter your phone number (e.g. +15551234567): +1234567890
[FLUX] Requesting verification code...
[FLUX] Verification code: d33gwu
[FLUX] Opening iMessage to send verification code...
[FLUX] Please send the code "d33gwu" to +16286298650 via iMessage.
[FLUX] Waiting for verification...
[FLUX] Successfully logged in as +1234567890
```

If already logged in: 

```
npx @photon-ai/flux login

[FLUX] Already logged in as +1234567890
```

Log out: 

```
npx @photon-ai/flux logout

[FLUX] Logged out.
```

### Step 3: Validate

Validate that your agent works and exports correctly: 

```
npx @photon-ai/flux validate

[FLUX] Validating agent.ts...
[FLUX] Agent is valid!
```

### Step 4: Testing Mode

Test your agent through your terminal (no iMessage connection): 

```
npx @photon-ai/flux run --local

[FLUX] Welcome to Flux! Your agent is loaded.
[FLUX] Type a message to test it. Press Ctrl+C to exit.

You: Hello!
[FLUX] Thinking...
Agent: Hello! How can I assist you today?
```

### Step 5: Live Connection

Run your agent locally and connect it to the iMessage bridge. When you message the FLUX number with your phone number, you will receive the output of your LangChain agent: 

```
npx @photon-ai/flux run --prod

[FLUX] Loading agent from agent.ts...
[FLUX] Agent loaded successfully!
[FLUX] Connected to server at fluxy.photon.codes:443
[FLUX] Registered agent for +1234567890
[FLUX] Agent running in production mode. Press Ctrl+C to stop.
[FLUX] Messages to +1234567890 will be processed by your agent.

```

---

## Why Flux

Right now, connecting agents to messaging platforms involves complex processes such as setting up servers, configuring webhooks, and dealing with platform APIs. Furthermore, most current options use SMS or WhatsApp, which is unintuitive for many users. 

Flux solves these problems in the following ways: 

- **Deploy in < 5 seconds**: Link your LangChain agent to iMessage with a single command.
- **Fully iMessage native**: Direct iMessage integration, not SMS or WhatsApp. 
- **Zero Infrastructure**: No servers to manage, webhooks to configure, or Apple Developer account needed. 
- **Open source**: Fully community driven.
- **Free to use**: No subscription fees.

---

## Examples

### Echo Bot (No LLM)

```
// agent.ts
export default {
  async invoke({ message }: { message: string }) {
    return `You said: ${message}`;
  }
};
```

### ChatGPT Bot

```
// agent.ts
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

const llm = new ChatOpenAI({ modelName: "gpt-4o-mini" });

export default {
  async invoke({ message }: { message: string }) {
    const response = await llm.invoke([
      new SystemMessage("You are a helpful assistant. Be concise."),
      new HumanMessage(message),
    ]);
    return response.content as string;
  }
};
```

### Chatbot with tools

```
// agent.ts
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { z } from "zod";

const calculator = tool(
  async ({ expression }: { expression: string }) => {
    return String(eval(expression));
  },
  {
    name: "calculator",
    description: "Evaluate a math expression",
    schema: z.object({ expression: z.string() }),
  }
);

const getTime = tool(
  async () => new Date().toLocaleTimeString(),
  {
    name: "get_time",
    description: "Get the current time",
    schema: z.object({}),
  }
);

const llm = new ChatOpenAI({ modelName: "gpt-4o-mini" });
const agent = createReactAgent({ llm, tools: [calculator, getTime] });

export default {
  async invoke({ message }: { message: string }) {
    const result = await agent.invoke({ messages: [{ role: "user", content: message }] });
    return result.messages[result.messages.length - 1].content as string;
  }
};
```

---

## Requirements

- **Node.js** 18+ (for the CLI)
- **Python** 3.9+ (for the agent)
- **LLM Keys (e.g. OpenAI API key)**

---


<div align="center">
  <sub>Built with ⚡ by <a href="https://photon.codes">Photon</a></sub>
</div>