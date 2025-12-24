// Represents a message to be sent via iMessage through the Flux server.
export interface OutgoingMessage {
  userPhoneNumber: string;
  text: string;
  chatGuid?: string;
}