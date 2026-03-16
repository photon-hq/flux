# Flux Tests

This directory contains tests for the Flux CLI.

## Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode (re-runs on file changes)
bun test --watch

# Run specific test file
bun test src/__tests__/agent-loader.test.ts
```

## Test Structure

- `__tests__/` - Test files (*.test.ts)
- `__tests__/fixtures/` - Test fixtures and sample agent files

## Coverage

### agent-loader.test.ts

Tests for agent discovery, validation, and loading functionality:

**findAgentFile()**
- ✅ Returns null when no agent file exists
- ✅ Finds agent.ts in current directory
- ✅ Finds agent.js in current directory
- ✅ Prefers agent.ts over agent.js when both exist

**validateAgentFile()**
- ✅ Validates correct TypeScript agent files
- ✅ Validates correct JavaScript agent files
- ✅ Rejects agents without default export
- ✅ Rejects agents without invoke method
- ✅ Rejects agents where invoke is not a function
- ✅ Handles invalid syntax gracefully
- ✅ Handles non-existent files
- ✅ Handles empty files

**loadAgent()**
- ✅ Loads valid TypeScript agents
- ✅ Loads valid JavaScript agents
- ✅ Returns invokable agent
- ✅ Handles TypeScript features (interfaces, types)

**Integration Tests**
- ✅ Complete workflow: find → validate → load → invoke
- ✅ Handles workflow with invalid agent

## Test Fixtures

Test fixtures are located in `fixtures/` directory:

- `valid-agent.ts` - Valid TypeScript agent for testing
- `valid-agent.js` - Valid JavaScript agent for testing
- `no-default-export.ts` - Agent missing default export
- `no-invoke-method.ts` - Agent missing invoke method
- `invoke-not-function.ts` - Agent where invoke is not a function
- `invalid-syntax.ts` - Agent with syntax errors

## Writing New Tests

When adding new test files:

1. Name files with `.test.ts` extension
2. Import from `bun:test`: `import { describe, it, expect } from "bun:test"`
3. Use `beforeEach`/`afterEach` for setup/cleanup
4. Group related tests in `describe` blocks
5. Make test descriptions clear and specific

Example:

```typescript
import { describe, it, expect } from "bun:test";

describe("myModule", () => {
  it("should do something specific", () => {
    expect(true).toBe(true);
  });
});
```

## Notes

- Tests use Bun's built-in test runner (no additional dependencies needed)
- Temporary test directories are automatically cleaned up
- The `tsx` warning messages during tests are expected and don't affect test results
