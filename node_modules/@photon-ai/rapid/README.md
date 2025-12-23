# @photon-ai/rapid

Toolkit for rapid AI and agent prototyping. Rapid gives you reusable building blocks so you can validate new agent architectures, memory systems, and workflows without rebuilding the interface layer every time.

## Why Rapid
- Terminal-first developer experience for iterating on prompts, memory, and control flows.
- Composable modules exposed as ESM entry points; mix and match what you need.
- TypeScript-first API with strong types for chat messages, event handlers, and controller handles.

## Installation
Install the package with your preferred manager (Node.js 18+):

```bash
npm install @photon-ai/rapid
# or
pnpm add @photon-ai/rapid
# or
bun add @photon-ai/rapid
```

Rapid expects a TypeScript toolchain (`typescript@^5.9.3` as a peer dependency). If you are running in CommonJS, bundle or load with a compatible transpiler such as `ts-node/register`.

## Module Catalog
This section will expand as new building blocks ship. Each module lives under an explicit export path so you can import only what you need.

| Category | Module | Description | Status |
| --- | --- | --- | --- |
| Chat TUI | `@photon-ai/rapid/cli-chat` | Ink-powered terminal chat UI with message panel, input bar, and controller API. | Available |

## Usage Patterns
### CLI Chat
Render the chat surface inside your CLI and connect it to your agent logic.

```ts
// demo.ts
import { renderChatUI } from "@photon-ai/rapid/cli-chat";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const chat = renderChatUI();

chat.sendMessage("Welcome to Rapid! Type anything and I'll echo it back.");

chat.onInput(async (prompt) => {
    chat.sendMessage("Thinking...");
    await delay(500);
    chat.sendMessage(`Echo: ${prompt.toUpperCase()}`);
});

// Keep the Ink app alive. Press Ctrl+C to exit.
await new Promise(() => {});
```

Run the example with your preferred TypeScript runner:

```bash
ts-node demo.ts
```

#### Controller API snapshot
- `renderChatUI()` mounts the Ink application and returns an imperative controller.
- `chat.onInput(handler)` registers listeners for user-submitted prompts (supports async handlers).
- `chat.sendMessage(content)` streams assistant messages back into the UI in real time.

## Developing New Modules
- Add modules under `src/<module-name>` and export them via `package.json`.
- Document each module with a short description and example import path in the catalog above.
- Keep runnable snippets in this README so users can copy-paste and tinker.

## Repo Scripts
Rapid uses [Bun](https://bun.com) for scripts and dependency management:

```bash
bun install        # install dependencies
bun run src/index.ts
```

## Contributions
Contributions, bug reports, and ideas are welcome—open an issue or PR when you build something others can reuse.
