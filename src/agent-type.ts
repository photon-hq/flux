// Defines the FluxAgent interface that user agents must implement.

import { Message } from "./memory";

// Type for the sendMessage function passed to onInit for proactive messaging
export type SendMessageFn = (to: string, text: string) => Promise<boolean>;

// Tapback reaction types supported by iMessage
export type TapbackType = 'love' | 'like' | 'dislike' | 'laugh' | 'emphasize' | 'question';

// Type for the sendTapback function passed to onInit for sending reactions
// chat: The conversation identifier (phone number like "+1234567890" or group ID)
export type SendTapbackFn = (messageGuid: string, reaction: TapbackType, chat: string) => Promise<boolean>;

export interface FluxAgent {
  // Called once when agent is loaded. Receives sendMessage and sendTapback for proactive messaging (prod mode only).
  onInit?: (sendMessage?: SendMessageFn, sendTapback?: SendTapbackFn) => Promise<void>;
  // Called for each incoming message. Must return a response string.
  // history: Array of previous messages in the conversation (includes both user and assistant messages).
  invoke: (input: { message: string; userPhoneNumber: string; messageGuid?: string; imageBase64?: string; history: Message[] }) => Promise<string>;
  // Called when invoke throws an error.
  onError?: (error: Error) => Promise<void>;
  // Called on graceful shutdown (Ctrl+C or readline close).
  onShutdown?: () => Promise<void>;
}