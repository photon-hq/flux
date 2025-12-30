// Defines the FluxAgent interface that user agents must implement.

// Type for the sendMessage function passed to onInit for proactive messaging
export type SendMessageFn = (to: string, text: string) => Promise<boolean>;

export interface FluxAgent {
  // Called once when agent is loaded. Receives sendMessage for proactive messaging (prod mode only).
  onInit?: (sendMessage?: SendMessageFn) => Promise<void>;
  // Called for each incoming message. Must return a response string.
  invoke: (input: { message: string; userPhoneNumber: string; imageBase64?: string }) => Promise<string>;
  // Called when invoke throws an error.
  onError?: (error: Error) => Promise<void>;
  // Called on graceful shutdown (Ctrl+C or readline close).
  onShutdown?: () => Promise<void>;
}