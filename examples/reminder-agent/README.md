# Personal Reminder Agent

A simple personal reminder agent built with Flux that lets you set reminders via iMessage.

## What it can do
- Set one off reminders via text
- Supports relative and absolute times
- Sends reminders back to your phone via iMessage

## Example messages
- "Remind me to submit the form tomorrow at 5pm"
- "Ping me in 30 minutes"
- "Remind me to check my phone in 30 seconds"
- "Remind me to drink water at 9pm"

## How to run

```bash
flux run --local
# or
flux run --prod
```

## Important Notes

- **Local Mode**: In local mode, reminders are only delivered when you send your next message to the agent (no background scheduler).
- **Production Mode**: In production mode, reminders are sent proactively via iMessage when they're due! The scheduler checks every 10 seconds and sends reminders automatically.
- **Phone Number**: In local mode, the phone number is hardcoded as `+1234567890` for testing purposes. Your actual phone number is only used in production mode.
