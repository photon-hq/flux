// Represents a message received from iMessage via the Flux server.
export interface IncomingMessage {
  userPhoneNumber: string;
  text: string;
  imageBase64?: string;
  chatGuid: string;
  messageGuid: string;
}