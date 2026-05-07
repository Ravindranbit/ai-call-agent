# 🛠️ 1092 Assist: Project Setup & Execution Guide

This guide provides step-by-step instructions to get the **1092 Assist AI Voice Agent** up and running in a local or production environment.

---

## Prerequisites

Before starting, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **Git**
- **PostgreSQL** (Local or Cloud instance like Render/ElephantSQL)
- **Redis** (Local or Cloud instance like Upstash)
- **Cloudflare Tunnel** (or ngrok) to expose your local server to Twilio webhooks.

---

## 1. Environment Configuration

Create a `.env` file in the root directory. You can use the template below:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
PUBLIC_URL=https://your-tunnel-url.trycloudflare.com

# AI API Keys
GROQ_API_KEY=your_groq_api_key_here
SARVAM_API_KEY=your_sarvam_api_key_here

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/ai_call_agent

# Session Persistence (Redis)
REDIS_URL=redis://localhost:6379

# Telephony (Twilio)
TWILIO_ACCOUNT_SID=your_sid_here
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### Key Descriptions:
- **PUBLIC_URL:** The URL where Twilio will send webhooks.
- **GROQ_API_KEY:** Powering the Llama-3 model for fast intent analysis.
- **SARVAM_API_KEY:** Powering the Sarvam-M model for high-fidelity Indic languages.

---

## 2. Installation Steps

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/your-repo/ai-call-agent.git
   cd ai-call-agent
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Database Initialization:**
   The application automatically initializes the required tables (`call_summaries`, `call_transcripts`, `feedback_logs`, etc.) upon the first successful connection. Ensure your `DATABASE_URL` is correct.

---

## 3. Telephony Setup (Twilio)

1. **Expose your Localhost:**
   Start a Cloudflare tunnel to get a public URL:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
2. **Configure Webhooks:**
   - Log in to your **Twilio Console**.
   - Navigate to **Phone Numbers** > **Manage** > **Active Numbers**.
   - Select your number and scroll to the **Voice & Fax** section.
   - Under **A CALL COMES IN**, set the webhook to:
     `https://your-tunnel-url.trycloudflare.com/api/call/incoming`
   - Set the method to **HTTP POST**.

---

## 4. Running the Application

### Development Mode (with hot-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

---

## 5. Using the Dashboard

Once the server is running, navigate to:
`http://localhost:3000/dashboard`

- **Agent Panel:** Use the "Make Call" section to trigger an outbound call to your own phone for testing.
- **Live Monitor:** Watch as the AI detects emotion, intent, and records transcripts in real-time.
- **Feedback Loop:** If the AI misidentifies an intent, use the "Submit Correction" button to help train the system.

---

## 🛠 Troubleshooting

- **Twilio Webhook Error:** Ensure your `PUBLIC_URL` in `.env` exactly matches your tunnel URL and is saved.
- **AI Latency:** Check your Groq/Sarvam API credits.
- **Active Calls Stuck:** Ensure the `statusCallback` is correctly firing (handled automatically in `twilioService.js`).
- **Database Connection:** If using Render PostgreSQL, ensure you use the **External Connection String**.

---
