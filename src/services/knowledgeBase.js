// src/services/knowledgeBase.js
// Real Karnataka Government Department Directory
// All phone numbers are publicly available official numbers.

const DEPARTMENTS = {
  water_supply: {
    department: 'BWSSB (Bangalore Water Supply & Sewerage Board)',
    phones: ['1916', '080-22945300'],
    description: {
      'en-IN': 'For water supply complaints, call BWSSB helpline 1916 or 080-22945300.',
      'kn-IN': 'ನೀರು ಸರಬರಾಜು ದೂರುಗಳಿಗೆ, BWSSB ಸಹಾಯವಾಣಿ 1916 ಅಥವಾ 080-22945300 ಕರೆ ಮಾಡಿ.',
      'hi-IN': 'पानी की आपूर्ति की शिकायत के लिए, BWSSB हेल्पलाइन 1916 या 080-22945300 पर कॉल करें।',
      'ta-IN': 'நீர் வழங்கல் புகார்களுக்கு, BWSSB உதவி எண் 1916 அல்லது 080-22945300 அழைக்கவும்.'
    }
  },
  electricity_issue: {
    department: 'BESCOM (Bangalore Electricity Supply Company)',
    phones: ['1912', '080-22876666'],
    description: {
      'en-IN': 'For electricity complaints, call BESCOM helpline 1912 or 080-22876666.',
      'kn-IN': 'ವಿದ್ಯುತ್ ದೂರುಗಳಿಗೆ, BESCOM ಸಹಾಯವಾಣಿ 1912 ಅಥವಾ 080-22876666 ಕರೆ ಮಾಡಿ.',
      'hi-IN': 'बिजली की शिकायत के लिए, BESCOM हेल्पलाइन 1912 या 080-22876666 पर कॉल करें।',
      'ta-IN': 'மின்சார புகார்களுக்கு, BESCOM உதவி எண் 1912 அல்லது 080-22876666 அழைக்கவும்.'
    }
  },
  police_complaint: {
    department: 'Karnataka Police',
    phones: ['100', '112'],
    description: {
      'en-IN': 'For police assistance, call 100 or the emergency number 112.',
      'kn-IN': 'ಪೊಲೀಸ್ ಸಹಾಯಕ್ಕಾಗಿ, 100 ಅಥವಾ ತುರ್ತು ಸಂಖ್ಯೆ 112 ಕರೆ ಮಾಡಿ.',
      'hi-IN': 'पुलिस सहायता के लिए, 100 या आपातकालीन नंबर 112 पर कॉल करें।',
      'ta-IN': 'காவல்துறை உதவிக்கு, 100 அல்லது அவசர எண் 112 அழைக்கவும்.'
    }
  },
  health_emergency: {
    department: 'Karnataka Health Services / 108 Ambulance',
    phones: ['108', '104', '080-22660000'],
    description: {
      'en-IN': 'For medical emergency, call 108 for ambulance. Health helpline: 104. BBMP Health: 080-22660000.',
      'kn-IN': 'ವೈದ್ಯಕೀಯ ತುರ್ತು ಪರಿಸ್ಥಿತಿಗೆ, ಆಂಬ್ಯುಲೆನ್ಸ್‌ಗೆ 108 ಕರೆ ಮಾಡಿ. ಆರೋಗ್ಯ ಸಹಾಯವಾಣಿ: 104. BBMP ಆರೋಗ್ಯ: 080-22660000.',
      'hi-IN': 'चिकित्सा आपातकाल के लिए, एम्बुलेंस के लिए 108 पर कॉल करें। स्वास्थ्य हेल्पलाइन: 104। BBMP स्वास्थ्य: 080-22660000।',
      'ta-IN': 'மருத்துவ அவசரத்திற்கு, ஆம்புலன்ஸுக்கு 108 அழைக்கவும். சுகாதார உதவி எண்: 104. BBMP சுகாதாரம்: 080-22660000.'
    }
  },
  road_complaint: {
    department: 'BBMP (Bruhat Bengaluru Mahanagara Palike)',
    phones: ['080-22660000', '1533'],
    description: {
      'en-IN': 'For road and pothole complaints, call BBMP at 080-22660000 or pothole helpline 1533.',
      'kn-IN': 'ರಸ್ತೆ ಮತ್ತು ಗುಂಡಿ ದೂರುಗಳಿಗೆ, BBMP 080-22660000 ಅಥವಾ ಗುಂಡಿ ಸಹಾಯವಾಣಿ 1533 ಕರೆ ಮಾಡಿ.',
      'hi-IN': 'सड़क और गड्ढे की शिकायत के लिए, BBMP 080-22660000 या गड्ढा हेल्पलाइन 1533 पर कॉल करें।',
      'ta-IN': 'சாலை மற்றும் குழி புகார்களுக்கு, BBMP 080-22660000 அல்லது குழி உதவி எண் 1533 அழைக்கவும்.'
    }
  },
  civic_inspection: {
    department: 'BBMP (Bruhat Bengaluru Mahanagara Palike)',
    phones: ['080-22660000', '1533'],
    description: {
      'en-IN': 'For civic issues like garbage, drainage, and sanitation, call BBMP at 080-22660000.',
      'kn-IN': 'ಕಸ, ಒಳಚರಂಡಿ, ಮತ್ತು ನೈರ್ಮಲ್ಯ ಸಮಸ್ಯೆಗಳಿಗೆ, BBMP 080-22660000 ಕರೆ ಮಾಡಿ.',
      'hi-IN': 'कचरा, नाली और स्वच्छता जैसी नागरिक समस्याओं के लिए, BBMP 080-22660000 पर कॉल करें।',
      'ta-IN': 'குப்பை, வடிகால் மற்றும் சுகாதார பிரச்சனைகளுக்கு, BBMP 080-22660000 அழைக்கவும்.'
    }
  },
  corruption_report: {
    department: 'Karnataka Lokayukta',
    phones: ['080-22261056', '1064'],
    description: {
      'en-IN': 'To report corruption, contact Karnataka Lokayukta at 080-22261056 or anti-corruption helpline 1064.',
      'kn-IN': 'ಭ್ರಷ್ಟಾಚಾರ ವರದಿ ಮಾಡಲು, ಕರ್ನಾಟಕ ಲೋಕಾಯುಕ್ತ 080-22261056 ಅಥವಾ ಭ್ರಷ್ಟಾಚಾರ ನಿಗ್ರಹ ಸಹಾಯವಾಣಿ 1064 ಸಂಪರ್ಕಿಸಿ.',
      'hi-IN': 'भ्रष्टाचार की रिपोर्ट करने के लिए, कर्नाटक लोकायुक्त 080-22261056 या भ्रष्टाचार निरोधक हेल्पलाइन 1064 से संपर्क करें।',
      'ta-IN': 'ஊழலை புகாரளிக்க, கர்நாடக லோகாயுக்தா 080-22261056 அல்லது ஊழல் தடுப்பு உதவி எண் 1064 தொடர்பு கொள்ளவும்.'
    }
  },
  legal_divorce: {
    department: 'Karnataka State Legal Services Authority (KSLSA)',
    phones: ['080-22113854', '15100'],
    description: {
      'en-IN': 'For free legal aid including family matters, contact KSLSA at 080-22113854 or legal helpline 15100.',
      'kn-IN': 'ಕುಟುಂಬ ವಿಷಯಗಳ ಸೇರಿದಂತೆ ಉಚಿತ ಕಾನೂನು ಸಹಾಯಕ್ಕಾಗಿ, KSLSA 080-22113854 ಅಥವಾ ಕಾನೂನು ಸಹಾಯವಾಣಿ 15100 ಸಂಪರ್ಕಿಸಿ.',
      'hi-IN': 'पारिवारिक मामलों सहित मुफ्त कानूनी सहायता के लिए, KSLSA 080-22113854 या कानूनी हेल्पलाइन 15100 से संपर्क करें।',
      'ta-IN': 'குடும்ப விவகாரங்கள் உட்பட இலவச சட்ட உதவிக்கு, KSLSA 080-22113854 அல்லது சட்ட உதவி எண் 15100 தொடர்பு கொள்ளவும்.'
    }
  },
  pension_query: {
    department: 'Janaspandana / Karnataka Pension Portal',
    phones: ['080-22032929', '1092'],
    description: {
      'en-IN': 'For pension queries, contact Janaspandana at 080-22032929 or call 1092.',
      'kn-IN': 'ಪಿಂಚಣಿ ಪ್ರಶ್ನೆಗಳಿಗೆ, ಜನಸ್ಪಂದನ 080-22032929 ಅಥವಾ 1092 ಕರೆ ಮಾಡಿ.',
      'hi-IN': 'पेंशन प्रश्नों के लिए, जनस्पंदन 080-22032929 या 1092 पर कॉल करें।',
      'ta-IN': 'ஓய்வூதிய கேள்விகளுக்கு, ஜனஸ்பந்தன 080-22032929 அல்லது 1092 அழைக்கவும்.'
    }
  },
  education_query: {
    department: 'Karnataka Education Department',
    phones: ['080-22261581', '1092'],
    description: {
      'en-IN': 'For education related queries, contact the Education Department at 080-22261581 or call 1092.',
      'kn-IN': 'ಶಿಕ್ಷಣ ಸಂಬಂಧಿತ ಪ್ರಶ್ನೆಗಳಿಗೆ, ಶಿಕ್ಷಣ ಇಲಾಖೆ 080-22261581 ಅಥವಾ 1092 ಕರೆ ಮಾಡಿ.',
      'hi-IN': 'शिक्षा संबंधित प्रश्नों के लिए, शिक्षा विभाग 080-22261581 या 1092 पर कॉल करें।',
      'ta-IN': 'கல்வி தொடர்பான கேள்விகளுக்கு, கல்வித் துறை 080-22261581 அல்லது 1092 அழைக்கவும்.'
    }
  },
  women_safety: {
    department: 'Women Helpline / Karnataka State Commission for Women',
    phones: ['181', '112'],
    description: {
      'en-IN': 'For women safety or domestic violence, call Women Helpline 181 or emergency 112.',
      'kn-IN': 'ಮಹಿಳಾ ಸುರಕ್ಷತೆ ಅಥವಾ ಗೃಹ ಹಿಂಸೆಗಾಗಿ, ಮಹಿಳಾ ಸಹಾಯವಾಣಿ 181 ಅಥವಾ ತುರ್ತು 112 ಕರೆ ಮಾಡಿ.',
      'hi-IN': 'महिला सुरक्षा या घरेलू हिंसा के लिए, महिला हेल्पलाइन 181 या आपातकालीन 112 पर कॉल करें।',
      'ta-IN': 'பெண்கள் பாதுகாப்பு அல்லது குடும்ப வன்முறைக்கு, பெண்கள் உதவி எண் 181 அல்லது அவசர எண் 112 அழைக்கவும்.'
    }
  },
  child_safety: {
    department: 'Childline India',
    phones: ['1098', '112'],
    description: {
      'en-IN': 'For child safety concerns, call Childline at 1098 or emergency 112.',
      'kn-IN': 'ಮಕ್ಕಳ ಸುರಕ್ಷತೆ ಸಮಸ್ಯೆಗಳಿಗೆ, ಚೈಲ್ಡ್‌ಲೈನ್ 1098 ಅಥವಾ ತುರ್ತು 112 ಕರೆ ಮಾಡಿ.',
      'hi-IN': 'बच्चों की सुरक्षा चिंताओं के लिए, चाइल्डलाइन 1098 या आपातकालीन 112 पर कॉल करें।',
      'ta-IN': 'குழந்தை பாதுகாப்பு கவலைகளுக்கு, சைல்ட்லைன் 1098 அல்லது அவசர எண் 112 அழைக்கவும்.'
    }
  },
  fire_emergency: {
    department: 'Karnataka Fire & Emergency Services',
    phones: ['101', '112'],
    description: {
      'en-IN': 'For fire emergencies, call 101 or emergency 112.',
      'kn-IN': 'ಅಗ್ನಿ ತುರ್ತು ಪರಿಸ್ಥಿತಿಗೆ, 101 ಅಥವಾ ತುರ್ತು 112 ಕರೆ ಮಾಡಿ.',
      'hi-IN': 'आग की आपातकाल के लिए, 101 या आपातकालीन 112 पर कॉल करें।',
      'ta-IN': 'தீ அவசரத்திற்கு, 101 அல்லது அவசர எண் 112 அழைக்கவும்.'
    }
  }
};

// Fallback for intents not in the directory
const FALLBACK_INFO = {
  department: '1092 Karnataka Helpline',
  phones: ['1092'],
  description: {
    'en-IN': 'For further assistance, please call the 1092 Karnataka Helpline again during working hours.',
    'kn-IN': 'ಹೆಚ್ಚಿನ ಸಹಾಯಕ್ಕಾಗಿ, ದಯವಿಟ್ಟು ಕೆಲಸದ ಸಮಯದಲ್ಲಿ 1092 ಕರ್ನಾಟಕ ಸಹಾಯವಾಣಿಗೆ ಮತ್ತೆ ಕರೆ ಮಾಡಿ.',
    'hi-IN': 'अधिक सहायता के लिए, कृपया कार्य समय में 1092 कर्नाटक हेल्पलाइन पर फिर से कॉल करें।',
    'ta-IN': 'மேலும் உதவிக்கு, வேலை நேரத்தில் 1092 கர்நாடகா உதவி எண்ணை மீண்டும் அழைக்கவும்.'
  }
};

/**
 * Get contact info for a given intent.
 * Returns { department, phones, description } or fallback.
 */
function getContactInfo(intent) {
  return DEPARTMENTS[intent] || FALLBACK_INFO;
}

/**
 * Get a localized department description for a given intent and language.
 */
function getDepartmentContext(intent, languageCode) {
  const info = getContactInfo(intent);
  return info.description[languageCode] || info.description['en-IN'];
}

/**
 * Build a compact knowledge base summary for the LLM system prompt.
 * This gives the LLM REAL numbers to use instead of hallucinating.
 */
function getKnowledgeBaseForPrompt() {
  const lines = [];
  for (const [intent, info] of Object.entries(DEPARTMENTS)) {
    lines.push(`${intent}: ${info.department} — ${info.phones.join(', ')}`);
  }
  return lines.join('\n');
}

/**
 * Get all known departments (for dashboard display).
 */
function getAllDepartments() {
  return Object.entries(DEPARTMENTS).map(([intent, info]) => ({
    intent,
    department: info.department,
    phones: info.phones
  }));
}

module.exports = {
  getContactInfo,
  getDepartmentContext,
  getKnowledgeBaseForPrompt,
  getAllDepartments
};
