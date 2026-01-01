// In-memory storage for conversation history, keyed by phone number.

export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: number;
  imageBase64?: string;
}

export class Memory {
  private store: Map<string, Message[]> = new Map();

  // Add a message to a conversation
  add(phoneNumber: string, message: Message): void {
    const normalized = this.normalizePhone(phoneNumber);
    if (!this.store.has(normalized)) {
      this.store.set(normalized, []);
    }
    this.store.get(normalized)!.push(message);
  }

  // Get all messages for a conversation
  get(phoneNumber: string): Message[] {
    const normalized = this.normalizePhone(phoneNumber);
    return this.store.get(normalized) || [];
  }

  // Clear history for a specific conversation, or all if no phone provided
  clear(phoneNumber?: string): void {
    if (phoneNumber) {
      this.store.delete(this.normalizePhone(phoneNumber));
    } else {
      this.store.clear();
    }
  }

  // Normalize phone number format
  private normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)]/g, "");
  }
}

// Singleton instance for the CLI
export const memory = new Memory();
