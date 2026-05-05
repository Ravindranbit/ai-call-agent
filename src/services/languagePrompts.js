// src/services/languagePrompts.js
// Centralized user-facing prompt translations for the 1092 Karnataka Helpline.
// Uses GENERIC localized templates that work for ANY topic.
// Known intents can optionally override with specific translations.

// ──────────────────────────────────────────────────────────────
// 🟡 MEDIUM CONFIDENCE — Generic confirmation templates
// These work for ANY intent, no hardcoding per topic needed
// ──────────────────────────────────────────────────────────────

const genericConfirmationPrompts = {
  'kn-IN': 'ನೀವು ಹೇಳಿದ್ದು ಅರ್ಥವಾಯಿತು ಎಂದು ಅನಿಸುತ್ತಿದೆ. ನಾನು ಚೆನ್ನಾಗಿ ಸಹಾಯ ಮಾಡಲು ಮತ್ತೊಮ್ಮೆ ಹೇಳಬಹುದೇ?',
  'en-IN': 'I think I understood what you said. Could you say it once more so I can help you better?',
  'hi-IN': 'मुझे लगता है मैं समझ गया। क्या आप एक बार और कह सकते हैं ताकि मैं बेहतर मदद कर सकूँ?',
  'ta-IN': 'நீங்கள் சொன்னது புரிந்தது போல இருக்கிறது. நான் சரியாக உதவ, ஒரு முறை மீண்டும் சொல்ல முடியுமா?'
};

// Optional: specific overrides for sensitive/known intents
const intentSpecificOverrides = {
  legal_divorce: {
    'kn-IN': 'ನೀವು ವಿಚ್ಛೇದನದ ಬಗ್ಗೆ ಕೇಳುತ್ತಿದ್ದೀರಾ?',
    'en-IN': 'Are you asking about divorce?',
    'hi-IN': 'क्या आप तलाक के बारे में पूछ रहे हैं?',
    'ta-IN': 'நீங்கள் விவாகரத்து பற்றி கேட்கிறீர்களா?'
  },
  domestic_violence: {
    'kn-IN': 'ನೀವು ಗೃಹ ಹಿಂಸೆ ಬಗ್ಗೆ ಹೇಳುತ್ತಿದ್ದೀರಾ?',
    'en-IN': 'Are you reporting domestic violence?',
    'hi-IN': 'क्या आप घरेलू हिंसा की शिकायत कर रहे हैं?',
    'ta-IN': 'நீங்கள் குடும்ப வன்முறை பற்றி புகார் செய்கிறீர்களா?'
  },
  corruption_report: {
    'kn-IN': 'ನೀವು ಭ್ರಷ್ಟಾಚಾರದ ಬಗ್ಗೆ ಹೇಳುತ್ತಿದ್ದೀರಾ?',
    'en-IN': 'Are you reporting a case of corruption?',
    'hi-IN': 'क्या आप भ्रष्टाचार की शिकायत कर रहे हैं?',
    'ta-IN': 'நீங்கள் ஊழல் புகார் செய்கிறீர்களா?'
  },
  road_complaint: {
    'kn-IN': 'ನೀವು ರಸ್ತೆ ಸಮಸ್ಯೆ ಬಗ್ಗೆ ಹೇಳುತ್ತಿದ್ದೀರಾ?',
    'en-IN': 'Are you complaining about a road issue?',
    'hi-IN': 'क्या आप सड़क की समस्या बता रहे हैं?',
    'ta-IN': 'நீங்கள் சாலை பிரச்சனை பற்றி புகார் செய்கிறீர்களா?'
  },
  water_supply: {
    'kn-IN': 'ನೀವು ನೀರಿನ ಸಮಸ್ಯೆ ಬಗ್ಗೆ ಹೇಳುತ್ತಿದ್ದೀರಾ?',
    'en-IN': 'Are you reporting a water supply issue?',
    'hi-IN': 'क्या आप पानी की समस्या बता रहे हैं?',
    'ta-IN': 'நீங்கள் தண்ணீர் பிரச்சனை பற்றி புகார் செய்கிறீர்களா?'
  },
  electricity_issue: {
    'kn-IN': 'ನೀವು ವಿದ್ಯುತ್ ಸಮಸ್ಯೆ ಬಗ್ಗೆ ಹೇಳುತ್ತಿದ್ದೀರಾ?',
    'en-IN': 'Are you reporting an electricity problem?',
    'hi-IN': 'क्या आप बिजली की समस्या बता रहे हैं?',
    'ta-IN': 'நீங்கள் மின்சார பிரச்சனை பற்றி புகார் செய்கிறீர்களா?'
  },
  police_complaint: {
    'kn-IN': 'ನೀವು ಪೊಲೀಸ್ ಸಹಾಯ ಬಯಸುತ್ತಿದ್ದೀರಾ?',
    'en-IN': 'Do you need police assistance?',
    'hi-IN': 'क्या आपको पुलिस सहायता चाहिए?',
    'ta-IN': 'நீங்கள் போலீஸ் உதவி வேண்டுமா?'
  },
  health_emergency: {
    'kn-IN': 'ನಿಮಗೆ ವೈದ್ಯಕೀಯ ಸಹಾಯ ಬೇಕೇ?',
    'en-IN': 'Do you need medical assistance?',
    'hi-IN': 'क्या आपको चिकित्सा सहायता चाहिए?',
    'ta-IN': 'நீங்கள் மருத்துவ உதவி வேண்டுமா?'
  },
  pension_query: {
    'kn-IN': 'ನೀವು ಪಿಂಚಣಿ ಬಗ್ಗೆ ಕೇಳುತ್ತಿದ್ದೀರಾ?',
    'en-IN': 'Are you asking about pension?',
    'hi-IN': 'क्या आप पेंशन के बारे में पूछ रहे हैं?',
    'ta-IN': 'நீங்கள் ஓய்வூதியம் பற்றி கேட்கிறீர்களா?'
  },
  gift_saree: {
    'kn-IN': 'ನೀವು ಸೀರೆ ಬಗ್ಗೆ ಕೇಳುತ್ತಿದ್ದೀರಾ?',
    'en-IN': 'Are you asking about sarees?',
    'hi-IN': 'क्या आप साड़ी के बारे में पूछ रहे हैं?',
    'ta-IN': 'நீங்கள் புடவை பற்றி கேட்கிறீர்களா?'
  }
};

// ──────────────────────────────────────────────────────────────
// 🔴 LOW CONFIDENCE — Rotating fallback prompts (anti-robotic)
// ──────────────────────────────────────────────────────────────

const fallbackPrompts = {
  'kn-IN': [
    'ಕ್ಷಮಿಸಿ, ನನಗೆ ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಬಹುದೇ?',
    'ಸ್ವಲ್ಪ ಸ್ಪಷ್ಟವಾಗಿ ಮಾತನಾಡಬಹುದೇ?',
    'ನಿಮ್ಮ ಧ್ವನಿ ಸರಿಯಾಗಿ ಬರುತ್ತಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.'
  ],
  'en-IN': [
    "Sorry, I didn't hear that clearly. Can you say it again?",
    "Could you speak a little more clearly?",
    "I'm having trouble hearing you. Could you please try again?"
  ],
  'hi-IN': [
    'माफ़ कीजिए, मुझे साफ़ सुनाई नहीं दिया। क्या आप फिर से कह सकते हैं?',
    'क्या आप थोड़ा और स्पष्ट बोल सकते हैं?',
    'मुझे सुनने में कठिनाई हो रही है। कृपया दोबारा कोशिश करें।'
  ],
  'ta-IN': [
    'மன்னிக்கவும், தெளிவாக கேட்கவில்லை. தயவுசெய்து மீண்டும் சொல்ல முடியுமா?',
    'சற்று தெளிவாக பேச முடியுமா?',
    'உங்கள் குரல் சரியாக வரவில்லை, தயவுசெய்து மீண்டும் முயற்சிக்கவும்.'
  ]
};

// 🔴 LOW CONFIDENCE (repeated 3+ times) — escalation-tier
const repeatedFallbackPrompts = {
  'kn-IN': 'ಕ್ಷಮಿಸಿ, ನನಗೆ ಇನ್ನೂ ಅರ್ಥ ಮಾಡಿಕೊಳ್ಳಲು ಕಷ್ಟವಾಗುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸ್ಪಷ್ಟವಾಗಿ ಮಾತನಾಡಬಹುದೇ?',
  'en-IN': "Sorry, I am still having trouble understanding. Could you please speak a bit more clearly?",
  'hi-IN': 'माफ़ कीजिए, मुझे अभी भी समझने में कठिनाई हो रही है। क्या आप थोड़ा और स्पष्ट बोल सकते हैं?',
  'ta-IN': 'மன்னிக்கவும், தொடர்ந்து புரியவில்லை. தயவுசெய்து சற்று தெளிவாக பேச முடியுமா?'
};

// AI quality guard — when AI returns junk/too-short response
const aiQualityFallbackPrompts = {
  'kn-IN': 'ಕ್ಷಮಿಸಿ, ನನಗೆ ಸರಿಯಾಗಿ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಬಹುದೇ?',
  'en-IN': "Sorry, I didn't quite understand that. Could you say it again?",
  'hi-IN': 'माफ़ कीजिए, मैं सही से समझ नहीं पाया। क्या आप फिर से कह सकते हैं?',
  'ta-IN': 'மன்னிக்கவும், நான் சரியாக புரிந்துகொள்ளவில்லை. மீண்டும் சொல்ல முடியுமா?'
};

// 🟡 PARTIAL CONFIRMATION — When citizen says "kind of" / "somewhat"
const partialConfirmationPrompts = {
  'kn-IN': 'ಸರಿ, ನಾನು ಭಾಗಶಃ ಅರ್ಥಮಾಡಿಕೊಂಡಿದ್ದೇನೆ. ದಯವಿಟ್ಟು ಯಾವ ಭಾಗ ತಪ್ಪಾಗಿದೆ ಎಂದು ಹೇಳಿ.',
  'en-IN': 'Okay, I partially understood. Please tell me which part was wrong.',
  'hi-IN': 'ठीक है, मैंने आंशिक रूप से समझा। कृपया बताएँ कि कौन सा हिस्सा गलत है।',
  'ta-IN': 'சரி, நான் ஓரளவு புரிந்துகொண்டேன். எந்த பகுதி தவறு என்று சொல்லுங்கள்.'
};

// ──────────────────────────────────────────────────────────────
// FUNCTIONS
// ──────────────────────────────────────────────────────────────

// 🟡 Medium confidence — Uses specific override if available, otherwise generic
function getIntentPrompt(intent, lang) {
  // Check for a specific override first (known intents like divorce, corruption, etc.)
  if (intentSpecificOverrides[intent]?.[lang]) {
    return intentSpecificOverrides[intent][lang];
  }
  if (intentSpecificOverrides[intent]?.['en-IN']) {
    return intentSpecificOverrides[intent]['en-IN'];
  }
  // Fallback to generic confirmation — works for ANY topic
  return genericConfirmationPrompts[lang] || genericConfirmationPrompts['en-IN'];
}

// 🔴 Low confidence — rotating randomly to feel human
function getFallbackPrompt(lang) {
  const list = fallbackPrompts[lang] || fallbackPrompts['en-IN'];
  return list[Math.floor(Math.random() * list.length)];
}

// 🔴 Low confidence (repeated) — escalation tier
function getRepeatedFallbackPrompt(lang) {
  return repeatedFallbackPrompts[lang] || repeatedFallbackPrompts['en-IN'];
}

// AI quality guard
function getAiQualityFallbackPrompt(lang) {
  return aiQualityFallbackPrompts[lang] || aiQualityFallbackPrompts['en-IN'];
}

// 🟡 Partial confirmation — citizen says "kind of" / "somewhat"
function getPartialConfirmationPrompt(lang) {
  return partialConfirmationPrompts[lang] || partialConfirmationPrompts['en-IN'];
}

module.exports = {
  getIntentPrompt,
  getFallbackPrompt,
  getRepeatedFallbackPrompt,
  getAiQualityFallbackPrompt,
  getPartialConfirmationPrompt
};
