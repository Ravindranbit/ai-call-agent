// src/services/summarizationService.js
// Compresses older conversation messages into a short summary + extracts key facts.
// Uses the same Groq API for summarization (no extra dependency).

const config = require('../config');
const logger = require('../utils/logger');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Summarize older messages into a 2-3 sentence summary.
 * Merges with any existing summary from earlier in the call.
 */
async function summarizeMessages(messages, existingSummary, languageCode) {
  try {
    if (!messages || messages.length === 0) return existingSummary || '';
    if (!config.groqApiKey) return existingSummary || '';

    const transcript = messages
      .map(m => `${m.role === 'user' ? 'Caller' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const prompt = `You are a conversation summarizer for a phone call assistant.

${existingSummary ? `EXISTING SUMMARY FROM EARLIER:\n${existingSummary}\n` : ''}
NEW MESSAGES TO ADD:
${transcript}

TASK: Write a concise 2-3 sentence summary combining the existing summary (if any) with the new messages. 
Focus on: what the user wants, their preferences, key decisions, and emotional state.
Remove filler phrases and repeated questions.
Write the summary in English regardless of the conversation language.
Return ONLY the summary text, nothing else.`;

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.groqApiKey}`
      },
      body: JSON.stringify({
        model: config.groqModel,
        temperature: 0.2,
        max_tokens: 150,
        messages: [
          { role: 'system', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Groq summarization returned ${response.status}`);
    }

    const data = await response.json();
    const summary = data?.choices?.[0]?.message?.content?.trim() || existingSummary || '';

    logger.info('Conversation summarized', {
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
