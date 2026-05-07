const logger = require('../utils/logger');

// Centralized input normalization
function normalizeInput(input) {
  if (!input) return '';
  return String(input)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// 3-LEVEL CONFIRMATION: yes / no / partial
const YES_PATTERN = /(ஆம்|ஆமா|ஆமாம்|ஆம் தான்|சரி|சரிதான்|ஓகே|ஓகே|ஹா|ஆம்மா|yes|yeah|correct|yep|yup|right|ok|okay|हाँ|हां|जी|जी हाँ|सही|ठीक|बिल्कुल|ಹೌದು|ಹೂ|ಹೂಂ|ಸರಿ|ಸರಿ ಹೌದು|ಹೌದಪ್ಪ|ಓಕೆ)/i;
const NO_PATTERN = /(இல்லை|இல்ல|வேண்டாம்|வேணாம்|no|nope|nah|wrong|நோ|गलत|नहीं|ना|ಇಲ್ಲ|ಬೇಡ|ತಪ್ಪು|ಅಲ್ಲ)/i;
const PARTIAL_PATTERN = /(kind of|somewhat|partially|sort of|almost|not exactly|ஓரளவு|கொஞ்சம்|சரி ஆனா|कुछ हद तक|थोड़ा|बिल्कुल नहीं|ಸ್ವಲ್ಪ ಹೌದು|ಸ್ವಲ್ಪ|ಅಷ್ಟೇನೂ ಇಲ್ಲ|ಸರಿ ಆದರೆ)/i;

/**
 * Detects 3-level confirmation: 'yes', 'no', 'partial', or 'unclear'
 */
function detectConfirmation(input) {
  const normalized = normalizeInput(input);
  // Check partial FIRST, then NO before YES (to prevent "வேணாம்" matching "ம்" YES token)
  if (PARTIAL_PATTERN.test(normalized)) return 'partial';
  if (NO_PATTERN.test(normalized)) return 'no';
  if (YES_PATTERN.test(normalized)) return 'yes';
  return 'unclear';
}

// Define intent configuration with fuzzy matching and system hints
// Expanded for 1092 Karnataka government helpline common topics
const intentConfig = [
  {
    name: 'legal_divorce',
    type: 'sensitive',
    keywords: ['டைவர்ஸ்', 'டைவரசு', 'விவாகரத்து', 'divorce', 'तलाक', 'ವಿಚ್ಛೇದನ'],
    systemHint: 'User is asking about divorce (legal topic). Respond seriously and appropriately.',
    extractEntities: (text) => {
      return { topic: 'divorce' };
    }
  },
  {
    name: 'domestic_violence',
    type: 'sensitive',
    keywords: ['abuse', 'beating', 'violence', 'ಹಿಂಸೆ', 'ಹೊಡೆಯುತ್ತಾರೆ', 'ಥಳಿಸುತ್ತಾರೆ', 'हिंसा', 'मारपीट', 'கொடுமை', 'அடிக்கிறார்'],
    systemHint: 'User is reporting domestic violence. Respond with extreme empathy and urgency.',
    extractEntities: (text) => ({ topic: 'domestic_violence' })
  },
  {
    name: 'corruption_report',
    type: 'sensitive',
    keywords: ['corruption', 'bribe', 'ಭ್ರಷ್ಟಾಚಾರ', 'ಲಂಚ', 'भ्रष्टाचार', 'रिश्वत', 'லஞ்சம்', 'ஊழல்'],
    systemHint: 'User is reporting corruption. Handle with seriousness and confidentiality.',
    extractEntities: (text) => ({ topic: 'corruption' })
  },
  {
    name: 'road_complaint',
    type: 'normal',
    keywords: ['road', 'pothole', 'ರಸ್ತೆ', 'ಗುಂಡಿ', 'सड़क', 'गड्ढा', 'சாலை', 'குழி'],
    systemHint: 'User is complaining about road conditions.',
    extractEntities: (text) => ({ topic: 'road', preference: null })
  },
  {
    name: 'water_supply',
    type: 'normal',
    keywords: ['water', 'ನೀರು', 'ನೀರಿನ', 'पानी', 'தண்ணீர்', 'நீர்'],
    systemHint: 'User has a water supply issue.',
    extractEntities: (text) => ({ topic: 'water_supply' })
  },
  {
    name: 'electricity_issue',
    type: 'normal',
    keywords: ['electricity', 'power', 'current', 'ವಿದ್ಯುತ್', 'ಕರೆಂಟ್', 'बिजली', 'மின்சாரம்', 'கரெண்ட்'],
    systemHint: 'User has an electricity/power issue.',
    extractEntities: (text) => ({ topic: 'electricity' })
  },
  {
    name: 'police_complaint',
    type: 'sensitive',
    keywords: ['police', 'theft', 'robbery', 'ಪೊಲೀಸ್', 'ಕಳ್ಳತನ', 'ದರೋಡೆ', 'पुलिस', 'चोरी', 'போலீஸ்', 'திருட்டு'],
    systemHint: 'User needs police assistance.',
    extractEntities: (text) => ({ topic: 'police' })
  },
  {
    name: 'health_emergency',
    type: 'sensitive',
    keywords: ['hospital', 'ambulance', 'doctor', 'ಆಸ್ಪತ್ರೆ', 'ಆಂಬ್ಯುಲೆನ್ಸ್', 'ವೈದ್ಯ', 'अस्पताल', 'एम्बुलेंस', 'डॉक्टर', 'மருத்துவமனை', 'ஆம்புலன்ஸ்'],
    systemHint: 'User needs medical help. This is urgent.',
    extractEntities: (text) => ({ topic: 'health_emergency' })
  },
  {
    name: 'pension_query',
    type: 'normal',
    keywords: ['pension', 'ಪಿಂಚಣಿ', 'ವೃದ್ಧಾಪ್ಯ', 'पेंशन', 'ஓய்வூதியம்'],
    systemHint: 'User is asking about pension.',
    extractEntities: (text) => ({ topic: 'pension' })
  },
  {
    name: 'ration_card',
    type: 'normal',
    keywords: ['ration', 'ration card', 'bpl', 'ಪಡಿತರ', 'ರೇಷನ್', 'राशन', 'ரேஷன்'],
    systemHint: 'User is asking about ration card.',
    extractEntities: (text) => ({ topic: 'ration_card' })
  },
  {
    name: 'gift_saree',
    type: 'normal',
    keywords: ['புடவை', 'சாரி', 'saree', 'साड़ी', 'ಸೀರೆ'],
    systemHint: 'User is specifically asking for saree gift suggestions.',
    extractEntities: (text) => {
      const entities = { topic: 'saree', preference: null };
      if (/சிவப்பு|red|लाल|ಕೆಂಪು/i.test(text)) entities.preference = 'red';
      else if (/பச்சை|green|हरा|ಹಸಿರು/i.test(text)) entities.preference = 'green';
      else if (/பட்டு|silk|रेशम|ರೇಷ್ಮೆ/i.test(text)) entities.preference = 'silk';
      return entities;
    }
  }
];

function scoreKeywordMatch(input, keyword) {
  // exact match
  if (input === keyword) return 1.0;

  // word boundary match
  const boundaryRegex = new RegExp(`\\b${keyword}\\b`, 'i');
  if (boundaryRegex.test(input)) return 0.8;

  // substring match
  if (input.includes(keyword)) return 0.5;

  return 0;
}

function detectIntent(input) {
  const normalized = normalizeInput(input);
  if (!normalized || normalized.length < 2) return null;

  let bestIntent = null;
  let bestScore = 0;

  for (const intent of intentConfig) {
    for (const keyword of intent.keywords) {
      const score = scoreKeywordMatch(normalized, keyword.toLowerCase());

      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }
  }

  if (bestIntent && bestScore > 0) {
    const entities = bestIntent.extractEntities ? bestIntent.extractEntities(normalized) : { topic: null, preference: null };
    return {
      name: bestIntent.name,
      type: bestIntent.type,
      systemHint: bestIntent.systemHint,
      entities: entities,
      confidence: bestScore
    };
  }

  return null; // No specific intent matched
}

module.exports = {
  normalizeInput,
  detectConfirmation,
  detectIntent
};
