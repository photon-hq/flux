<div align="center">

![Banner](./.github/assets/banner.png)

# @photon-ai/flux

> An open-source CLI for deploying LangChain agents to iMessage in seconds

</div>

[![npm version](https://img.shields.io/npm/v/@photon-ai/flux.svg)](https://www.npmjs.com/package/@photon-ai/flux)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![GitHub release](https://img.shields.io/github/v/release/photon-hq/flux?include_prereleases)](https://github.com/photon-hq/flux/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/bZd4CMd2H5)

Flux is an open-sourced CLI tool that lets developers build and deploy LangChain agents that connect to iMessage at no cost and under 5 seconds. 

## Features 


- **Deploy with a single command**: Export a LangChain agent and deploy it to iMessage with one command
- **Text your agent from your phone**: Send an iMessage to the Flux number and get responses from your running agent
- **Testing mode**: Test your agent through your terminal before connecting to the iMessage bridge
- **Phone Number Authentication**: Log in with just your phone number and iMessage
- **Agent Validation**: Automatically validate your LangChain agent in the CLI

## Quick Start


Get started with Flux in seconds:

```bash
# No installation needed - use npx directly
npx @photon-ai/flux login

# Create your agent file
echo 'export default {
  async invoke({ message }: { message: string }) {
    return `You said: ${message}`;
  }
};' > agent.ts

# Test locally
npx @photon-ai/flux run --local

# Deploy to production
npx @photon-ai/flux run --prod
```

## 📦 Installation

### Recommended: Global Installation

For the best experience, install Flux globally:

```bash
npm install -g @photon-ai/flux
# or
bun add -g @photon-ai/flux
```

Then run commands directly:

```bash
flux login
flux run --local
flux run --prod
```

### Alternative: Use npx (No Installation Required)

You can use Flux without installing it by using `npx` or `bunx`:

```bash
npx @photon-ai/flux login
npx @photon-ai/flux run --local
// or
bunx @photon-ai/flux login
bunx @photon-ai/flux run --local
```

> **Note:** When using `npx` or `bunx`, there's no need to install the package first. `npx` or `bunx` will download and execute it automatically.

### Local Installation (For Development)

If you're integrating Flux into a project:

```bash
npm install @photon-ai/flux
# or
bun add @photon-ai/flux
```

## 📖 Usage Guide

### Step 1: Create Your LangChain Agent

Create an `agent.ts` file with your LangChain agent. Make sure to have `export default agent`. Here's a simple example:

```typescript
// agent.ts
export default {
  async invoke({ message }: { message: string }) {
    return `You said: ${message}`;
  }
};
```

### Step 2: Authenticate with iMessage

Authenticate with your phone number and iMessage:

```bash
flux login
# or
npx @photon-ai/flux login
```

**Example session:**

```
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
[FLUX] Already logged in as +1234567890
```

To log out:

```bash
flux logout
```

```
[FLUX] Logged out.
```

### Step 3: Validate Your Agent

Validate that your agent works and exports correctly:

```bash
flux validate
# or
npx @photon-ai/flux validate
```

**Output:**

```
[FLUX] Validating agent.ts...
[FLUX] Agent is valid!
```

### Step 4: Test Locally (Development Mode)

Test your agent through your terminal (no iMessage connection):

```bash
flux run --local
# or
npx @photon-ai/flux run --local
```

**Interactive session:**

```
[FLUX] Welcome to Flux! Your agent is loaded.
[FLUX] Type a message to test it. Press Ctrl+C to exit.

You: Hello!
[FLUX] Thinking...
Agent: Hello! How can I assist you today?
```

### Step 5: Deploy to Production (Live iMessage)

Run your agent locally and connect it to the iMessage bridge. When you message the Flux number (`+16286298650`) from your registered phone, you'll receive responses from your LangChain agent:

```bash
flux run --prod
# or
npx @photon-ai/flux run --prod
```

**Output:**

```
[FLUX] Loading agent from agent.ts...
[FLUX] Agent loaded successfully!
[FLUX] Connected to server at fluxy.photon.codes:443
[FLUX] Registered agent for +1234567890
[FLUX] Agent running in production mode. Press Ctrl+C to stop.
[FLUX] Messages to +1234567890 will be processed by your agent.
```

Now text **`+16286298650`** from your phone to interact with your agent!

## 🛠️ CLI Commands

| Command | Description |
|---------|-------------|
| `flux` or `npx @photon-ai/flux` | Show help |
| `flux whoami` | Check currently logged-in account |
| `flux login` | Login and signup with phone number |
| `flux logout` | Logout from current session |
| `flux validate` | Check your agent code for errors |
| `flux run --local` | Start development server (local testing mode) |
| `flux run --prod` | Start with live iMessage bridge |

## 🔐 Authentication

Authentication is based on iMessage to ensure secure and simple access:

1. **Code Generation**: The server generates a unique UUID for each login attempt
2. **Phone Verification**: You send the verification code to the Flux number (`+16286298650`) via iMessage to prove phone ownership
3. **Token Issuance**: Once verified, the server issues an authentication token
4. **Persistent Login**: Credentials (token, phone, timestamp) are saved to `credentials.json`, so you only need to log in once

## Proactive Messaging 

Agents can initiate conversations without waiting for a user message.  In production mode, `onInit` receives a sendMessage function that lets your agent send messages at any time.

```
let sendMessage: (to: string, text: string) => Promise<boolean>;

export default {
  async onInit(send) {
    sendMessage = send;
    // Now you can call sendMessage() anywhere in your agent
  },
  // ...
};
```

## Multi-Bubble Responses

Agents can send multi-bubble responses by using '\n'. 

The `splitIntoMessages` helper function splits messages using `\n` and then loops through the split messages and sends each one. 

For example, `"Hello!\nHow are you?\nNice to meet you!"` will be sent as three separate message bubbles. 

## Tapbacks

Agents can send tapback reactions (love, like, dislike, laugh, emphasize, question). When your agent receives a message, it can react to it using the `sendTapback` function. 

To use `sendTapback`, you need to: 
1. Capture `sendTapback` in `onInit` once at startup
2. Call it in `invoke` when processing messages

```
import { FluxAgent, SendTapbackFn } from '@photon-ai/flux';

let sendTapback: SendTapbackFn | undefined;

const agent: FluxAgent = {
  onInit: async (_sendMessage, _sendTapback) => {
    sendTapback = _sendTapback;  // Save it for later
  },

  invoke: async ({ message, userPhoneNumber, messageGuid }) => {
    // Now you can use it
    if (sendTapback && messageGuid) {
      await sendTapback(messageGuid, 'love', userPhoneNumber);
    }

    return "Hello!";
  },
};

export default agent;
```

## 💡 Examples

### Weather Agent

An agent with a weather tool (returns mock data). 

```typescript
import * as z from "zod";
import { createAgent, tool } from "langchain";

const getWeather = tool(
  ({ city }) => `It's always sunny in ${city}!`,
  {
    name: "get_weather",
    description: "Get the weather for a given city",
    schema: z.object({
      city: z.string(),
    }),
  },
);

const agent = createAgent({
  model: "claude-sonnet-4-5-20250929",
  tools: [getWeather],
});

export default agent
```

### Chatbot with Memory

An advanced agent with memory:

```typescript
// agent.ts
import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

const llm = new ChatOpenAI({ modelName: "gpt-4o-mini" });
const history: Array<HumanMessage | AIMessage> = [];

export default {
  async invoke({ message }: { message: string }) {
    history.push(new HumanMessage(message));
    
    const response = await llm.invoke([
      new SystemMessage("You are a helpful assistant. Be concise."),
      ...history,
    ]);
    
    const reply = response.content as string;
    history.push(new AIMessage(reply));
    
    // Keep last 20 messages to avoid token limits
    if (history.length > 20) {
      history.splice(0, 2);
    }
    
    return reply;
  }
};
```

### Chatbot with Tapbacks

A conversational chatbot with tapback functionalities: 

```
import "dotenv/config";
import OpenAI from "openai";

const openai = new OpenAI();
const conversations = new Map<string, Array<{ role: "user" | "assistant" | "system"; content: string }>>();

let sendTapback: ((messageGuid: string, reaction: string, userPhoneNumber: string) => Promise<boolean>) | undefined;

export default {
  onInit: async (_sendMessage: any, _sendTapback: any) => {
    sendTapback = _sendTapback;
  },

  invoke: async ({ message, userPhoneNumber, messageGuid }: { message: string; userPhoneNumber: string; messageGuid?: string }) => {
    // Get or create conversation history
    if (!conversations.has(userPhoneNumber)) {
      conversations.set(userPhoneNumber, [{
        role: "system",
        content: "You are a friendly iMessage assistant. Keep responses concise. For positive messages, start with [TAPBACK:love], [TAPBACK:laugh], or [TAPBACK:like]."
      }]);
    }
    const history = conversations.get(userPhoneNumber)!;
    history.push({ role: "user", content: message });

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: history,
    });

    let response = completion.choices[0]?.message?.content || "Hello!";

    // Extract and send tapback if present
    const tapbackMatch = response.match(/^\[TAPBACK:(love|like|laugh|emphasize)\]/i);
    if (tapbackMatch && sendTapback && messageGuid) {
      await sendTapback(messageGuid, tapbackMatch[1].toLowerCase(), userPhoneNumber);
      response = response.replace(tapbackMatch[0], "").trim();
    }

    history.push({ role: "assistant", content: response });
    return response;
  },
};
```

##  Why Flux?

Connecting agents to messaging platforms traditionally involves complex processes like setting up servers, configuring webhooks, and dealing with platform APIs. Most solutions rely on SMS or WhatsApp, which can be unintuitive for many users.

**Flux solves these problems:**

- **Deploy in < 5 seconds** — Link your LangChain agent to iMessage with a single command
- **Fully iMessage native** — Direct iMessage integration, not SMS or WhatsApp
- **Zero Infrastructure** — No servers to manage, webhooks to configure, or Apple Developer account needed
- **Open source** — Fully community-driven and transparent
- **Free to use** — No subscription fees or hidden costs

## 👤 Single-User Design

**Important:** Flux is designed for personal use and development. When you deploy an agent with Flux, **only your registered phone number** can interact with it via iMessage. This means:

- ✅ Perfect for personal assistants and prototypes
- ✅ Great for testing and development
- ✅ Simple single-user experience
- ❌ Not designed for multi-user conversations
- ❌ No enterprise-level user management

### Need Enterprise Support?

For **enterprise-level iMessage agents** with advanced features, consider our [Advanced iMessage Kit](https://github.com/photon-hq/advanced-imessage-kit):

- **Multi-user support** — Handle thousands of users simultaneously
- **Dedicated phone line** — Get your own iMessage number
- **Enterprise features** — Advanced conversation management and analytics
- **Production-ready** — Enhanced stability and performance
- **More features** — Additional tools and integrations

[**Explore Advanced iMessage Kit →**](https://github.com/photon-hq/advanced-imessage-kit)

## ⚙️ Requirements

- **Node.js** 18+ or **Bun** (for the CLI)
- **Python** 3.9+ (for the agent, if using Python-based LangChain)
- **LLM API Keys** (e.g., OpenAI API key for GPT-powered agents)

## 🤝 Contributing

We welcome contributions! Flux is fully open source and community-driven. Feel free to:

- 🐛 [Report bugs](https://github.com/photon-hq/flux/issues)
- 💡 [Request features](https://github.com/photon-hq/flux/issues)
- 🔧 Submit pull requests
- ⭐ Star the repository

## 💬 Support

- **Discord**: Join our community at [discord.gg/bZd4CMd2H5](https://discord.gg/bZd4CMd2H5)
- **Issues**: Report problems on [GitHub Issues](https://github.com/photon-hq/flux/issues)
- **Documentation**: Check out this README for comprehensive guides

## 📄 License

MIT License - see the [LICENSE](./LICENSE) file for details.

<br /><div align="center">
  <sub>Built with ⚡ by <a href="https://photon.codes">Photon</a></sub>
</div>
