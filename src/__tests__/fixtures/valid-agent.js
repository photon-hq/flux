// Valid JavaScript agent for testing
export default {
  async invoke({ message, userPhoneNumber }) {
    return `Echo: ${message} from ${userPhoneNumber}`;
  }
};
