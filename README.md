# 1092 Assist: Empathetic AI for Citizen Services

> **Production-Grade Multilingual AI Voice Agent with Verified Understanding.**
> Built for the Karnataka Government 1092 Helpline.

This system replaces static IVRs with an intelligent, conversational AI capable of understanding citizen distress across multiple languages and dialects. Crucially, it prioritizes **Accurate Understanding over Speed** by utilizing an explicit "Verify Before Action" confirmation loop and seamless human-in-the-loop escalation.

---

## 🌟 Key Features

1. **Multilingual & Dialect Aware:** Speaks English, Hindi, Tamil, and Kannada natively using NVIDIA's Sarvam-M model. Detects local dialects and colloquialisms.
2. **Explicit Verification Loop:** The AI restates the citizen's problem and asks for confirmation to prevent hallucinations or wrong actions.
3. **Emotion & Urgency Detection:** Analyzes the sentiment of every turn (Distress, Anger, Fear, Calm) and flags urgent health/fire emergencies.
4. **Safe Human Takeover:** Automatically escalates to a human agent when intent confidence drops, repeated misunderstandings occur, or distress is high.
5. **Real-time Operations Dashboard:** A premium administrative panel allowing agents to view live calls, read transcripts, and instantly submit corrections to train the AI.
6. **Zero Hallucination Guardrails:** AI answers are strictly bounded by a hardcoded Government Knowledge Base.

---

## 🏗️ System Architecture & Tech Stack

- **Telephony & Voice:** Twilio Webhooks
- **Backend Service:** Node.js + Express
- **Hybrid AI Engine:** Groq (Llama-3 for ultra-low latency) + NVIDIA (Sarvam-M for Indian language depth)
- **State Management:** Redis (In-memory session persistence, survives server restarts)
- **Data Persistence:** PostgreSQL (Stores transcripts, summaries, analytics, and human feedback)
- **Local Tunnels:** Cloudflare Tunnels (Zero Trust)

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
Ensure you have Node.js, Docker (for Redis/Postgres), and a Cloudflare Tunnel installed.

### 2. Setup Services
Start the local Redis container:
```bash
docker-compose up -d
```
Ensure PostgreSQL is running locally and create a database named `ai_call_agent`.

### 3. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```
Fill in your API keys for Twilio, Groq, NVIDIA, and your database connection strings.

### 4. Install & Run
```bash
npm install
npm run dev
```

### 5. Expose Webhook
In a separate terminal, start your Cloudflare tunnel:
```bash
cloudflared tunnel --url http://localhost:3000
```
Copy the generated URL and update the `PUBLIC_URL` in your `.env` file and your Twilio Console Webhook settings.

---

## 📊 The Agent Dashboard

Navigate to `http://localhost:3000/dashboard` to access the Human-in-the-Loop Admin Panel.

- **Overview:** Real-time metrics on call volume, average turns, language distribution, and escalation rates.
- **Call History:** Dive into individual calls to read the live transcript and view confidence/emotion metadata.
- **Feedback & Learning:** Submit corrections to the AI's intent mapping to build a training dataset for continuous improvement.
