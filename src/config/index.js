const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/$/, '');
  if (!trimmed) return '';
  if (trimmed.includes('your-tunnel-url.trycloudflare.com')) return '';
  return trimmed;
}

const publicUrl = normalizeBaseUrl(process.env.PUBLIC_URL) || normalizeBaseUrl(process.env.BASE_URL);

module.exports = {
  port: process.env.PORT || 3000,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  defaultVoice: process.env.TWILIO_DEFAULT_VOICE || '',

  // AI Provider: 'nvidia', 'groq', or 'auto' (tries nvidia first, then groq)
  aiProvider: process.env.AI_PROVIDER || 'auto',

  // NVIDIA NIM (build.nvidia.com)
  nvidiaApiKey: process.env.NVIDIA_API_KEY || '',
  nvidiaModel: process.env.NVIDIA_MODEL || 'sarvamai/sarvam-m',

  // Groq
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',

  publicUrl,
  rawPublicUrl: process.env.PUBLIC_URL || '',
  baseUrl: process.env.BASE_URL || '',
  escalationPhoneNumber: process.env.ESCALATION_PHONE_NUMBER || '',
  escalationConfusionThreshold: parseInt(process.env.ESCALATION_CONFUSION_THRESHOLD || '4', 10),
  escalationClarificationThreshold: parseInt(process.env.ESCALATION_CLARIFICATION_THRESHOLD || '3', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  outboundNumbers: (process.env.OUTBOUND_NUMBERS || '').split(',').map(s => s.trim()).filter(Boolean)
};
