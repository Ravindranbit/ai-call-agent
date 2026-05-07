// src/services/summarizationService.js
// Compresses older conversation messages into a short summary + extracts key facts.
// Uses Groq (fast) for summarization — NVIDIA is too slow for background tasks.

const config = require('../config');
const logger = require('../utils/logger');

/**
 * Pick the best available provider for summarization.
 * For summarization we prefer Groq (fast + no thinking tags)
 * over NVIDIA Sarvam-M (slow + produces <think> tags that get truncated).
 */
function getProvider() {
  // Groq first — fast and no thinking tags
  if (config.groqApiKey) {
    return {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: config.groqApiKey,
      // Use a fast model for summarization (not the primary model which may be large)
      model: 'llama-3.1-8b-instant',
      name: 'groq'
    };
  }
  // Fallback to NVIDIA only if Groq is unavailable
  if (config.nvidiaApiKey) {
    return {
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      apiKey: config.nvidiaApiKey,
      model: config.nvidiaModel || 'sarvamai/sarvam-m',
      name: 'nvidia'
    };
  }
  return null;
}

/**
 * Strip ALL thinking-mode artifacts from LLM output.
 * Handles complete <think>...</think> tags AND truncated <think>... (no closing tag).
 */
function stripThinkingTags(text) {
  if (!text) return '';
  // First: strip complete <think>...</think> blocks
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  // Then: strip truncated <think>... (no closing tag — happens when max_tokens cuts it off)
  cleaned = cleaned.replace(/<think>[\s\S]*/g, '');
  return cleaned.trim();
}

/**
 * Summarize older messages into a 2-3 sentence summary.
 * Merges with any existing summary from earlier in the call.
 */
async function summarizeMessages(messages, existingSummary, languageCode) {
  try {
    if (!messages || messages.length === 0) return existingSummary || '';
    const provider = getProvider();
    if (!provider) return existingSummary || '';

    const transcript = messages
      .map(m => `${m.role === 'user' ? 'Caller' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const langNames = { 'kn-IN': 'Kannada', 'ta-IN': 'Tamil', 'hi-IN': 'Hindi', 'en-IN': 'English' };
    const langName = langNames[languageCode] || 'English';

    const prompt = `You are a conversation summarizer for a phone call assistant.

${existingSummary ? `EXISTING SUMMARY FROM EARLIER:\n${existingSummary}\n` : ''}
NEW MESSAGES TO ADD:
${transcript}

TASK: Write a concise 2-3 sentence summary combining the existing summary (if any) with the new messages. 
Focus on: what the user wants, their preferences, key decisions, and emotional state.
Remove filler phrases and repeated questions.
Write the summary in ${langName} (the same language as the conversation).
Return ONLY the summary text, nothing else. Do NOT include any XML tags or thinking process.`;

    const response = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        max_tokens: 200,
        messages: [
          { role: 'system', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`${provider.name} summarization returned ${response.status}`);
    }

    const data = await response.json();
    let summary = data?.choices?.[0]?.message?.content?.trim() || '';

    // Strip thinking tags (complete AND truncated)
    summary = stripThinkingTags(summary);
    if (!summary) summary = existingSummary || '';

    logger.info('Conversation summarized', {
      provider: provider.name,
      existingSummaryLength: existingSummary?.length || 0,
      newSummaryLength: summary.length,
      messagesCompressed: messages.length
    });

    return summary;
  } catch (error) {
    logger.error('Summarization failed — keeping existing summary', {
      error: error?.message || String(error)
    });
    return existingSummary || '';
  }
}

/**
 * Extract structured facts from recent messages.
 * Merges with existing facts (new facts override old ones).
 */
function extractFacts(messages, existingFacts, aiResult) {
  const facts = { ...existingFacts };

  // Update from AI analysis result (most reliable source)
  if (aiResult) {
    if (aiResult.intent && aiResult.intent !== 'general') {
      facts.topic = aiResult.intent;
    }
    if (aiResult.emotion) {
      facts.lastEmotion = aiResult.emotion;
    }
    if (aiResult.isSensitive) {
      facts.isSensitive = true;
    }
  }

  // Scan messages for preference-like patterns
  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    const text = (msg.content || '').toLowerCase();

    // Color preferences
    const colorMatch = text.match(/(red|blue|green|black|white|pink|yellow|சிவப்பு|பச்சை|நீலம்|लाल|हरा|नीला|ಕೆಂಪು|ಹಸಿರು|ನೀಲಿ)/i);
    if (colorMatch) facts.preferences = (facts.preferences || '') + ` ${colorMatch[1]}`;

    // Material preferences  
    const materialMatch = text.match(/(silk|cotton|chiffon|பட்டு|காட்டன்|रेशम|सूती|ರೇಷ್ಮೆ)/i);
    if (materialMatch) facts.preferences = (facts.preferences || '') + ` ${materialMatch[1]}`;
  }

  // Clean up preferences
  if (facts.preferences) {
    facts.preferences = [...new Set(facts.preferences.trim().split(/\s+/))].join(', ');
  }

  return facts;
}

module.exports = {
  summarizeMessages,
  extractFacts
};
