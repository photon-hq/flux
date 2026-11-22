// Agent without invoke method
export default {
  async process({ message }: { message: string }) {
    return `Echo: ${message}`;
  }
};
