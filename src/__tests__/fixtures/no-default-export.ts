// Agent without default export
export const agent = {
  async invoke({ message }: { message: string }) {
    return `Echo: ${message}`;
  }
};
