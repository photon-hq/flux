<div align="center">

![Banner](./.github/assets/banner.png)

# better-grpc

> Simple, typed gRPC for TypeScript

</div>

[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/bZd4CMd2H5)

**`better-grpc`** is a TypeScript-first gRPC library that focuses on developer experience and type safety. It eliminates the need for `.proto` files and code generation, allowing you to define your services entirely in TypeScript.

It enables seamless, **bidirectional** communication between a client and a server, allowing developers to call server-side functions from the client and client-side functions from the server, as if they were local.

## Features

-   **Type-Safe:** Define your services in TypeScript and get full type safety and autocompletion for your clients and servers.
-   **No `.proto` files:** No need to write `.proto` files or use `protoc` to generate code.
-   **Simple API:** The API is designed to be simple and intuitive.
-   **Symmetric Experience:** Call client-side functions from the server with the same syntax as calling server-side functions from the client.

## Installation

```bash
bun add better-grpc
# or
npm install better-grpc
# or
yarn add better-grpc
```

## Usage

### 1. Define a Service

Create an abstract class that extends `Service` to define your service. Use the `server` and `client` helpers to define where your function is implemented and executed.

```typescript
import { Service, client, server, bidi } from 'better-grpc';

abstract class MyService extends Service('MyService') {
    // This function is implemented and executed on the server.
    sayHello = server<(name: string) => string>();

    // This function is implemented and executed on the client.
    log = client<(message: string) => void>();

    // This function supports bidirectional streaming between client and server.
    chat = bidi<(message: string) => void>();
}
```

### 2. Implement the Service

Provide the implementations for the functions you defined for both the server and the client.

```typescript
// Server-side implementation
const myServiceImpl = MyService.Server({
    async sayHello(name: string) {
        return `Hello, ${name}!`;
    },
});

// Client-side implementation
const myClientImpl = MyService.Client({
    async log(message: string) {
        console.log(`[Server]: ${message}`);
    }
});
```

### 3. Create a Server

Create and start the server, passing in your service implementation.

```typescript
import { createGrpcServer } from 'better-grpc';

const server = await createGrpcServer(50051, myServiceImpl);
console.log('Server listening on port 50051');
```

### 4. Create a Client

Create a client for your service.

```typescript
import { createGrpcClient } from 'better-grpc';

const client = await createGrpcClient('localhost:50051', myClientImpl);
```

### 5. Make remote calls

Now you can call remote functions from both the client and the server.

```typescript
// On the client, call the server's `sayHello` function
const response = await client.MyService.sayHello('world');
console.log(response); // Outputs: 'Hello, world!'

// On the server, call client's `log` function
await server.MyService.log('Greeting from server');
// The client's console will show: '[Server]: Greeting from server'
```

### 6. Use bidirectional streams

Bidirectional gRPCs expose a function that both emits values (when you invoke it) and acts as an async iterator so you can consume the opposite side's messages.

```typescript
// Client usage
await client.MyService.chat('hello from client'); // emit to the server

for await (const [message] of client.MyService.chat) {
    console.log('Server replied:', message);
    break;
}

// Server usage mirrors the client
await server.MyService.chat('hello from server'); // emit to the client

for await (const [message] of server.MyService.chat) {
    console.log('Client replied:', message);
    break;
}
```

### 7. Attach typed metadata

Define metadata requirements with [Zod](https://github.com/colinhacks/zod) schemas, and `better-grpc` will automatically type the context on both sides and marshal the payload into gRPC metadata.

```typescript
import { Service, server, bidi } from 'better-grpc';
import { z } from 'zod';

abstract class GreeterService extends Service('GreeterService') {
    greet = server<(name: string) => string>()({
        metadata: z.object({ requestId: z.string() }),
    });

    chat = bidi<(message: string) => void>()({
        metadata: z.object({ room: z.string() }),
    });
}
```

Server implementations receive the typed metadata as the first argument:

```typescript
const GreeterServerImpl = GreeterService.Server({
    async greet(context, name) {
        console.log('Request', context.metadata.requestId);
        return `Hello, ${name}!`;
    },
});
```

On the client, unary calls that require metadata expose a `.withMeta()` helper, and bidi streams provide a `.context()` helper that must be awaited and called before sending messages (the bidi stream will be established after calling `.context()`):

```typescript
await client.GreeterService.greet('Ada').withMeta({ requestId: crypto.randomUUID() });

await client.GreeterService.chat.context({
    metadata: { room: 'general' },
});
// you must provide the context before calling the bidi function;
// otherwise, it will continue to wait.
await client.GreeterService.chat('hello from client');
```

On the server side, the bidi function expose a `.context` value that can be used to access metadata:

```typescript
const chatContext = await server.GreeterService.chat.context;
console.log(chatContext.metadata.room); // 'general'
````

## Why `better-grpc`?

The traditional workflow for creating gRPC services with TypeScript involves writing `.proto` files, using `protoc` to generate TypeScript code, and then using that generated code. This process can be cumbersome and result in a disconnect between your service definition and your code.

`better-grpc` solves this problem by allowing you to define your services entirely in TypeScript. This has several advantages:

-   **Single Source of Truth:** Your service definition lives in your TypeScript code, right next to your implementation.
-   **Improved Type Safety:** Leverage TypeScript's powerful type system for excellent autocompletion and type safety across your client and server.
-   **Simplified Workflow:** No more `.proto` files, no more code generation. Just write TypeScript.
-   **Symmetric Communication:** The server can invoke client functions with the same ease that the client invokes server functions, enabling powerful, bidirectional communication patterns.

## API

- `Service(name: string)`

A factory function that creates an abstract service class.

- `server<T>()`

Defines a server-side unary function signature. `T` should be a function type. Call the returned descriptor with `({ metadata: z.object({...}) })` to require typed metadata for that RPC. Client code then calls `client.MyService.fn(...args).withMeta({...})`, and server handlers receive the context object as the first argument.

- `client<T>()`

Defines a client-side unary function signature. `T` should be a function type.

- `bidi<T>()`

Defines a bidirectional stream signature. `T` should be a function type that returns `void`. Like `server()`, you can pass `({ metadata: schema })` to type the attached metadata; client stubs expose `bidiFn.context({ metadata })` and server stubs expose `await bidiFn.context` to read it.

- `createGrpcServer(port: number, ...services: ServiceImpl[])`

Creates and starts a gRPC server.

- `createGrpcClient(address: string, ...services: ServiceImpl[])`

Creates and starts a gRPC client.

## Benchmarks

### Simple "Hello World"

> [!NOTE]
> This benchmark's server and client were run on same local machine.

#### tRPC

```
tRPC: 1543.021833ms
```

#### Elysia

```
Elysia: 128.935791ms
```

#### better-grpc

```
better-grpc: 126.681042ms
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
