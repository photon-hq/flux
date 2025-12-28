// Defines the FluxAgent interface that user agents must implement.
// onInit is called once when the agent is loaded.
// onShutdown is called on graceful process exit.

export interface FluxAgent {
  onInit?: () => Promise<void>;
  invoke: (input: { message: string; userPhoneNumber: string; imageBase64?: string }) => Promise<string>;
  onError?: (error: Error) => Promise<void>;
  onShutdown?: () => Promise<void>;
}