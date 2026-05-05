function buildTwiml(xmlBody) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlBody}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Used when reprompting after empty/no speech
function buildSpeechGatherResponse({ ttsLang, speechLang, voice, prompt, actionPath, reprompt, speechHints }) {
  const voiceAttr = voice ? ` voice="${voice}"` : '';
  const escapedPrompt = escapeXml(prompt);

  // Turn-taking rule: Never place <Say> inside <Gather>. Place them sequentially instead.
  // Add speechModel, enhanced, and hints for high-accuracy Tamil transcription.
  const twiml = `<Response>\n` +
    `  <Say language="${ttsLang}"${voiceAttr}>${escapedPrompt}</Say>\n` +
    `  <Gather input="speech" language="${speechLang}" speechTimeout="auto" timeout="5" action="${actionPath}" method="POST" actionOnEmptyResult="true" speechModel="phone_call" enhanced="true" hints="${speechHints || ''}" />\n` +
    `</Response>`;

  return buildTwiml(twiml);
}

// Used after AI replies — says the AI response, then listens for next speech turn
function buildConversationLoopResponse({ ttsLang, speechLang, voice, messageText, actionPath, speechHints }) {
  const voiceAttr = voice ? ` voice="${voice}"` : '';
  const escapedMessage = escapeXml(messageText);

  // Turn-taking rule: Never place <Say> inside <Gather>. Place them sequentially instead.
  // Add speechModel, enhanced, and hints for high-accuracy Tamil transcription.
  const twiml = `<Response>\n` +
    `  <Say language="${ttsLang}"${voiceAttr}>${escapedMessage}</Say>\n` +
    `  <Gather input="speech" language="${speechLang}" speechTimeout="auto" timeout="5" action="${actionPath}" method="POST" actionOnEmptyResult="true" speechModel="phone_call" enhanced="true" hints="${speechHints || ''}" />\n` +
    `</Response>`;

  return buildTwiml(twiml);
}

// Used on errors / fallback — says the error message, then re-gathers
function buildFallbackResponse({ ttsLang, speechLang, voice, fallbackText, actionPath, speechHints }) {
  const voiceAttr = voice ? ` voice="${voice}"` : '';
  const escapedFallback = escapeXml(fallbackText);

  // Turn-taking rule: Never place <Say> inside <Gather>. Place them sequentially instead.
  // Add speechModel, enhanced, and hints for high-accuracy Tamil transcription.
  const twiml = `<Response>\n` +
    `  <Say language="${ttsLang}"${voiceAttr}>${escapedFallback}</Say>\n` +
    `  <Gather input="speech" language="${speechLang}" speechTimeout="auto" timeout="5" action="${actionPath}" method="POST" actionOnEmptyResult="true" speechModel="phone_call" enhanced="true" hints="${speechHints || ''}" />\n` +
    `</Response>`;

  return buildTwiml(twiml);
}

module.exports = {
  buildSpeechGatherResponse,
  buildConversationLoopResponse,
  buildFallbackResponse
};
