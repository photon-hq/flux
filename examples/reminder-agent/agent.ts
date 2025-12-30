import * as fs from "fs";
import * as path from "path";

interface FluxAgent {
  invoke: (input: { message: string; userPhoneNumber: string; imageBase64?: string }) => Promise<string>;
  init?: (sendMessage: (to: string, text: string) => Promise<boolean>) => void;
}

interface Reminder {
  id: string;
  userPhoneNumber: string;
  text: string;
  dueTime: number;
  createdAt: number;
}

const REMINDERS_FILE = path.join(process.cwd(), "reminders.json");
const SCHEDULER_INTERVAL_MS = 10_000; // 10 seconds
const LOCAL_TEST_PHONE = "+1234567890"; // when trying on local mode
const MAX_REMINDER_TEXT_LENGTH = 500;
const MAX_REMINDER_DAYS_AHEAD = 365;

let remindersCache: Reminder[] | null = null;

class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = async () => {
        if (this.locked) {
          this.queue.push(run); // push the request to queue
          return;
        }

        this.locked = true;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.locked = false;
          const next = this.queue.shift();
          if (next) next();
        }
      };
      run();
    });
  }
}

const fileMutex = new Mutex();

async function loadReminders(): Promise<Reminder[]> {
  return fileMutex.acquire(async () => {
    if (remindersCache !== null) {
      return remindersCache;
    }

    try {
      if (!fs.existsSync(REMINDERS_FILE)) {
        remindersCache = [];
        return [];
      }
      const content = fs.readFileSync(REMINDERS_FILE, "utf-8");
      if (!content.trim()) {
        remindersCache = [];
        return [];
      }
      const reminders = JSON.parse(content);
      remindersCache = reminders;
      return reminders;
    } catch (error) {
      console.error("[REMINDER] Error loading reminders:", error);
      remindersCache = [];
      return [];
    }
  });
}

async function saveReminders(reminders: Reminder[]): Promise<void> {
  return fileMutex.acquire(async () => {
    try {
      fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
      remindersCache = reminders;
    } catch (error) {
      console.error("[REMINDER] Error saving reminders:", error);
      throw error;
    }
  });
}

function convertTo24Hour(hours: number, ampm?: string): number {
  if (ampm === "pm" && hours !== 12) {
    return hours + 12;
  }
  if (ampm === "am" && hours === 12) {
    return 0;
  }
  return hours;
}

function parseRelativeTime(amount: number, unit: string): number {
  const unitMap: Record<string, number> = {
    s: 1000,
    seconds: 1000,
    second: 1000,
    sec: 1000,
    m: 60 * 1000,
    minutes: 60 * 1000,
    minute: 60 * 1000,
    min: 60 * 1000,
    h: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    hr: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
  };

  if (unitMap[unit]) {
    return amount * unitMap[unit];
  }

  for (const [key, multiplier] of Object.entries(unitMap)) {
    if (unit.startsWith(key)) {
      return amount * multiplier;
    }
  }
  return 0;
}

function parseTime(text: string): number | null {
  const now = Date.now();
  const lowerText = text.toLowerCase();

  const relativeMatch = lowerText.match(/in\s+(\d+)\s*(second|seconds|sec|minute|minutes|min|hour|hours|hr|day|days|week|weeks)/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2];
    const milliseconds = parseRelativeTime(amount, unit);
    if (milliseconds === 0) return null;
    return now + milliseconds;
  }

  const tomorrowMatch = lowerText.match(/tomorrow\s+at\s+(\d+)(?::(\d+))?\s*(am|pm)?/);
  if (tomorrowMatch) {
    let hours = parseInt(tomorrowMatch[1]);
    const minutes = tomorrowMatch[2] ? parseInt(tomorrowMatch[2]) : 0;
    const ampm = tomorrowMatch[3];
    hours = convertTo24Hour(hours, ampm);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(hours, minutes, 0, 0);
    return tomorrow.getTime();
  }

  const todayMatch = lowerText.match(/at\s+(\d+)(?::(\d+))?\s*(am|pm)?/);
  if (todayMatch) {
    let hours = parseInt(todayMatch[1]);
    const minutes = todayMatch[2] ? parseInt(todayMatch[2]) : 0;
    const ampm = todayMatch[3];
    hours = convertTo24Hour(hours, ampm);

    const today = new Date(now);
    today.setHours(hours, minutes, 0, 0);
    
    if (today.getTime() < now) {
      today.setDate(today.getDate() + 1);
    }
    
    return today.getTime();
  }

  return null;
}

function validateReminder(text: string, dueTime: number): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: "Reminder text cannot be empty" };
  }
  if (text.length > MAX_REMINDER_TEXT_LENGTH) {
    return { valid: false, error: `Reminder text must be less than ${MAX_REMINDER_TEXT_LENGTH} characters` };
  }
  
  const now = Date.now();
  if (dueTime <= now) {
    return { valid: false, error: "Reminder time must be in the future" };
  }
  
  const maxTime = now + (MAX_REMINDER_DAYS_AHEAD * 24 * 60 * 60 * 1000);
  if (dueTime > maxTime) {
    return { valid: false, error: `Reminder cannot be more than ${MAX_REMINDER_DAYS_AHEAD} days in the future` };
  }
  
  return { valid: true };
}

function extractReminderText(reminderText: string): string {
  const timePatterns = [
    /\s+in\s+\d+\s*(?:second|seconds|sec|minute|minutes|min|hour|hours|hr|day|days|week|weeks)\b/gi,
    /\s+tomorrow\s+at\s+\d+(?::\d+)?\s*(?:am|pm)?\b/gi,
    /\s+at\s+\d+(?::\d+)?\s*(?:am|pm)?\b/gi,
  ];

  let cleanText = reminderText;
  for (const pattern of timePatterns) {
    cleanText = cleanText.replace(pattern, "");
  }
  cleanText = cleanText.trim();

  return cleanText || "Reminder";
}

function parseReminder(message: string): { text: string; dueTime: number } | { error: string } | null {
  const remindMatch = message.match(/(?:remind\s+me\s+to\s+|remind\s+me\s+|ping\s+me\s+)(.+)/i);
  if (!remindMatch) {
    return null;
  }

  const reminderText = remindMatch[1].trim();
  
  const timeOnlyPatterns = [
    /^in\s+\d+\s*(second|seconds|sec|minute|minutes|min|hour|hours|hr|day|days|week|weeks)$/i,
    /^tomorrow\s+at\s+\d+(?::\d+)?\s*(am|pm)?$/i,
    /^at\s+\d+(?::\d+)?\s*(am|pm)?$/i,
  ];
  
  const isTimeOnly = timeOnlyPatterns.some(pattern => pattern.test(reminderText));
  const dueTime = parseTime(reminderText);

  if (!dueTime) {
    return {
      error: "I couldn't understand the time. Try:\n" +
        "• \"in 30 seconds\" or \"in 5 minutes\"\n" +
        "• \"tomorrow at 5pm\" or \"at 9pm\"\n" +
        "• Examples: \"Remind me to call mom in 2 hours\" or \"Remind me to submit the form tomorrow at 5pm\""
    };
  }

  if (isTimeOnly) {
    return { text: "Reminder", dueTime };
  }

  const cleanText = extractReminderText(reminderText);
  return { text: cleanText, dueTime };
}

async function getDueReminders(userPhoneNumber: string): Promise<Reminder[]> {
  const reminders = await loadReminders();
  const now = Date.now();
  
  return reminders.filter(
    (r) => r.userPhoneNumber === userPhoneNumber && r.dueTime <= now
  );
}

async function removeReminders(ids: string[]): Promise<void> {
  const reminders = await loadReminders();
  const filtered = reminders.filter((r) => !ids.includes(r.id));
  await saveReminders(filtered);
}

function generateReminderId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function createReminder(
  userPhoneNumber: string,
  text: string,
  dueTime: number
): Promise<Reminder> {
  const validation = validateReminder(text, dueTime);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid reminder");
  }

  const reminders = await loadReminders();
  const reminder: Reminder = {
    id: generateReminderId(),
    userPhoneNumber,
    text: text.trim(),
    dueTime,
    createdAt: Date.now(),
  };

  reminders.push(reminder);
  await saveReminders(reminders);
  return reminder;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatTimeUntil(dueTime: number): string {
  const secondsUntil = Math.round((dueTime - Date.now()) / 1000);
  if (secondsUntil < 60) {
    return `${secondsUntil} second${secondsUntil !== 1 ? 's' : ''}`;
  }
  const minutesUntil = Math.round(secondsUntil / 60);
  return `${minutesUntil} minute${minutesUntil !== 1 ? 's' : ''}`;
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let sendMessageFn: ((to: string, text: string) => Promise<boolean>) | null = null;
let signalsRegistered = false;

function groupRemindersByUser(reminders: Reminder[]): Map<string, Reminder[]> {
  const grouped = new Map<string, Reminder[]>();
  for (const reminder of reminders) {
    const userReminders = grouped.get(reminder.userPhoneNumber) || [];
    userReminders.push(reminder);
    grouped.set(reminder.userPhoneNumber, userReminders);
  }
  return grouped;
}

function formatReminderMessage(reminders: Reminder[]): string {
  const reminderTexts = reminders.map((r) => `⏰ ${r.text}`);
  return `Reminders:\n${reminderTexts.join("\n")}`;
}

async function processDueReminders(): Promise<void> {
  if (!sendMessageFn) return;

  const reminders = await loadReminders();
  const now = Date.now();
  const dueReminders = reminders.filter((r) => r.dueTime <= now);

  if (dueReminders.length === 0) return;

  const remindersByUser = groupRemindersByUser(dueReminders);

  for (const [userPhoneNumber, userReminders] of remindersByUser.entries()) {
    const message = formatReminderMessage(userReminders);

    sendMessageFn(userPhoneNumber, message)
      .then(async () => {
        await removeReminders(userReminders.map((r) => r.id));
      })
      .catch((error) => {
        console.error(`[REMINDER] Failed to send reminder to ${userPhoneNumber}:`, error);
      });
  }
}

function startScheduler(): void {
  if (schedulerInterval) {
    return;
  }

  schedulerInterval = setInterval(() => {
    processDueReminders().catch((error) => {
      console.error("[REMINDER] Error processing due reminders:", error);
    });
  }, SCHEDULER_INTERVAL_MS);
  console.log(`[REMINDER] Scheduler started - checking every ${SCHEDULER_INTERVAL_MS / 1000} seconds`);
}

function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[REMINDER] Scheduler stopped");
  }
}

function getHelpMessage(): string {
  return (
    "I can help you set reminders! Try:\n" +
    "• \"Remind me to submit the form tomorrow at 5pm\"\n" +
    "• \"Ping me in 30 minutes\"\n" +
    "• \"Remind me to check my phone in 30 seconds\"\n" +
    "• \"Remind me to drink water at 9pm\""
  );
}

function buildReminderConfirmation(reminder: Reminder, userPhoneNumber: string): string {
  const timeStr = formatTime(reminder.dueTime);
  let response = `Reminder created: "${reminder.text}" at ${timeStr}`;

  if (userPhoneNumber === LOCAL_TEST_PHONE) {
    response += `\n\nNote: In local mode, reminders will appear when you send your next message.`;
  } else if (sendMessageFn) {
    const timeUntil = formatTimeUntil(reminder.dueTime);
    response += `\n\n⏰ You'll receive this reminder in ${timeUntil}.`;
  } else {
    const timeUntil = formatTimeUntil(reminder.dueTime);
    response += `\n\n⏰ You'll receive this reminder in ${timeUntil} (when you send your next message).`;
  }

  return response;
}

const agent: FluxAgent = {
  async invoke({ message, userPhoneNumber }) {
    const dueReminders = await getDueReminders(userPhoneNumber);
    let response = "";

    if (dueReminders.length > 0) {
      response = formatReminderMessage(dueReminders) + "\n\n";
      await removeReminders(dueReminders.map((r) => r.id));
    }

    const reminder = parseReminder(message);

    if (reminder) {
      if ("error" in reminder) {
        response = reminder.error;
      } else {
        try {
          const createdReminder = await createReminder(
            userPhoneNumber,
            reminder.text,
            reminder.dueTime
          );
          response += buildReminderConfirmation(createdReminder, userPhoneNumber);
        } catch (error: any) {
          response = `Error: ${error.message}`;
        }
      }
    } else if (!response) {
      response = getHelpMessage();
    }

    return response;
  },

  init(sendMessage: (to: string, text: string) => Promise<boolean>) {
    sendMessageFn = sendMessage;
    startScheduler();

    if (!signalsRegistered) {
      process.on("SIGINT", stopScheduler);
      process.on("SIGTERM", stopScheduler);
      signalsRegistered = true;
    }
  },
};

export default agent;

