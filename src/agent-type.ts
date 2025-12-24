// Defines the FluxAgent interface that user agents must implement.
export interface FluxAgent {
  invoke: (input: { message: string; userPhoneNumber: string; imageBase64?: string }) => Promise<string>;
}