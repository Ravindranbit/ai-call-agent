# AI Call Agent — Phase 1

Phase 1: basic incoming call handling with multi-language selection.

Phase 2 adds a short AI voice conversation loop after language selection.

Setup

1. Copy `.env.example` to `.env` and set `PORT` (default 3000) and `TWILIO_DEFAULT_VOICE` (optional).
2. Install dependencies:

```bash
npm install
```

Run

```bash
npm run dev
```

Expose locally to Twilio with `ngrok`:

```bash
ngrok http 3000
```

Configure your Twilio phone number's Voice webhook to: `https://<ngrok-id>.ngrok.io/api/call/incoming` (HTTP POST).

Behavior

- `POST /api/call/incoming` — responds with a TwiML `<Gather>` that prompts: "Press 1 for English, 2 for Hindi, 3 for Tamil, 4 for Kannada".
- `POST /api/call/gather` — handles the selected digit and responds with a greeting in the selected language.

Notes

- This phase returns TwiML directly and logs caller number + timestamp. No signature validation is implemented — add in production.
- For AI conversation, add `OPENAI_API_KEY` in `.env`.
- The speech loop keeps responses short and voice-friendly, and reprompts when no speech is detected.
