// Valid TypeScript agent for testing
export default {
  async invoke({ message, userPhoneNumber }: { message: string; userPhoneNumber: string }) {
    return `Echo: ${message} from ${userPhoneNumber}`;
  }
};
