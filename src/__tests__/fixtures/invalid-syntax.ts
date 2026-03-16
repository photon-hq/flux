// Invalid TypeScript syntax
export default {
  async invoke({ message }: { message: string }) {
    return `Echo: ${message}
  } // Missing closing brace
