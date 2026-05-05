const config = require('../config');

// Using Google TTS voices explicitly for multilingual support
// Language order: Kannada (primary for 1092 Karnataka), Hindi, English, Tamil
const languageMap = {
  '1': {
    code: 'kn-IN',
    name: 'Kannada',
    ttsLang: 'kn-IN',
    speechLang: 'kn-IN',
    voice: 'Google.kn-IN-Standard-A',
    menuPrompt: 'ಕನ್ನಡಕ್ಕಾಗಿ 1, ಹಿಂದಿಗಾಗಿ 2, ಇಂಗ್ಲಿಷ್ಗಾಗಿ 3, ತಮಿಳಿಗಾಗಿ 4 ಒತ್ತಿರಿ.',
    greeting: 'ನಮಸ್ಕಾರ, ನೀವು 1092 ಸಹಾಯವಾಣಿಯನ್ನು ತಲುಪಿದ್ದೀರಿ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
    prompt: 'ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
    continuePrompt: 'ಮುಂದುವರಿಯಿರಿ, ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ.',
    reprompt: 'ಕ್ಷಮಿಸಿ, ಅದು ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ.',
    fallback: 'ಕ್ಷಮಿಸಿ, ನಾನು ಇದೀಗ ತೊಂದರೆಯಲ್ಲಿದ್ದೇನೆ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.',
    unclearReprompt: 'ಕ್ಷಮಿಸಿ, ನನಗೆ ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಬಹುದೇ?',
    escalationMessage: 'ನೀವು ಯಾರೊಂದಿಗಾದರೂ ಮಾತನಾಡಲು ಬಯಸುತ್ತೀರಿ ಎಂದು ತೋರುತ್ತದೆ. ದಯವಿಟ್ಟು ಕಾಯಿರಿ.',
    topicDriftMessage: 'ನಾವು ಈಗ ವಿಚ್ಛೇದನದ ಬಗ್ಗೆ ಮಾತನಾಡುತ್ತಿದ್ದೇವೆ. ನಾವು ಅದನ್ನು ಮುಂದುವರಿಸೋಣವೇ?',
    clarificationPrompt: 'ಸರಿ, ನಾನು ನಿಮಗೆ ಬೇರೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
    yesNoPrompt: 'ದಯವಿಟ್ಟು \'ಹೌದು\' ಅಥವಾ \'ಇಲ್ಲ\' ಎಂದು ಮಾತ್ರ ಹೇಳಿ.',
    unclearYesNoPrompt: 'ಕ್ಷಮಿಸಿ, ನನಗೆ ಸರಿಯಾಗಿ ಅರ್ಥವಾಗಲಿಲ್ಲ. ನೀವು \'ಹೌದು\' ಅಥವಾ \'ಇಲ್ಲ\' ಎಂದು ಹೇಳಬಹುದೇ?',
    divorceConfirmation: 'ನೀವು ವಿಚ್ಛೇದನದ ಬಗ್ಗೆ ಮಾತನಾಡುತ್ತಿದ್ದೀರಾ?',
    humanTransferPrompt: 'ನೀವು ನೇರವಾಗಿ ಯಾರೊಂದಿಗಾದರೂ ಮಾತನಾಡಲು ಬಯಸುತ್ತೀರಾ?',
    partiallyCorrectPrompt: 'ಸರಿ, ನಾನು ಭಾಗಶಃ ಅರ್ಥಮಾಡಿಕೊಂಡಿದ್ದೇನೆ. ದಯವಿಟ್ಟು ಯಾವ ಭಾಗ ತಪ್ಪಾಗಿದೆ ಎಂದು ಹೇಳಿ.',
    restatementPrefix: 'ನಾನು ಅರ್ಥಮಾಡಿಕೊಂಡಿದ್ದು ಹೀಗಿದೆ: ',
    restatementSuffix: '. ಇದು ಸರಿಯೇ?',
    speechHints: 'ಸೀರೆ,ಉಡುಗೊರೆ,ಸಹೋದರಿ,ಕಾರ್ಯಕ್ರಮ,ಅಂಗಡಿ,ಮದುವೆ,ವಿಚ್ಛೇದನ,ಹೌದು,ಇಲ್ಲ,ಸ್ವಲ್ಪ ಹೌದು,ಸಹಾಯ,ದೂರು,ಅಧಿಕಾರಿ,ಪೊಲೀಸ್,ನೀರು,ರಸ್ತೆ,ವಿದ್ಯುತ್,ಆಸ್ಪತ್ರೆ,ಶಾಲೆ,ಪಿಂಚಣಿ,ಭ್ರಷ್ಟಾಚಾರ,ಲಂಚ'
  },
  '2': {
    code: 'hi-IN',
    name: 'Hindi',
    ttsLang: 'hi-IN',
    speechLang: 'hi-IN',
    voice: 'Google.hi-IN-Standard-A',
    menuPrompt: 'कन्नड़ के लिए 1, हिंदी के लिए 2, अंग्रेज़ी के लिए 3, तमिल के लिए 4 दबाएँ।',
    greeting: 'नमस्ते, आप 1092 हेल्पलाइन पर पहुँच गए हैं। मैं आपकी क्या मदद कर सकता हूँ?',
    prompt: 'मैं आपकी क्या मदद कर सकता हूँ?',
    continuePrompt: 'बताइए, मैं सुन रहा हूँ।',
    reprompt: 'माफ़ कीजिए, मुझे सुनाई नहीं दिया। कृपया फिर से कहें।',
    fallback: 'माफ़ कीजिए, मुझे अभी कुछ परेशानी हो रही है। कृपया पुनः प्रयास करें।',
    unclearReprompt: 'माफ़ कीजिए, मुझे साफ़ सुनाई नहीं दिया। क्या आप फिर से कह सकते हैं?',
    escalationMessage: 'ऐसा लगता है कि आप किसी एजेंट से बात करना चाहते हैं। कृपया लाइन पर बने रहें।',
    topicDriftMessage: 'हम अभी तलाक के विषय पर बात कर रहे हैं। क्या हम इसे जारी रखें?',
    clarificationPrompt: 'ठीक है, मैं आपकी और कैसे मदद कर सकता हूँ?',
    yesNoPrompt: 'कृपया केवल \'हाँ\' या \'नहीं\' कहें।',
    unclearYesNoPrompt: 'माफ़ कीजिए, मुझे समझ नहीं आया। क्या आप \'हाँ\' या \'नहीं\' कह सकते हैं?',
    divorceConfirmation: 'क्या आप तलाक के बारे में बात कर रहे हैं?',
    humanTransferPrompt: 'क्या आप सीधे किसी एजेंट से बात करना चाहेंगे?',
    partiallyCorrectPrompt: 'ठीक है, मैंने आंशिक रूप से समझा। कृपया बताएँ कि कौन सा हिस्सा गलत है।',
    restatementPrefix: 'मैंने यह समझा है: ',
    restatementSuffix: '। क्या यह सही है?',
    speechHints: 'साड़ी,उपहार,बहन,समारोह,दुकान,शादी,तलाक,हाँ,नहीं,कुछ हद तक,सहायता,शिकायत,अधिकारी,पुलिस,पानी,सड़क,बिजली,अस्पताल,स्कूल,पेंशन,भ्रष्टाचार,रिश्वत'
  },
  '3': {
    code: 'en-IN',
    name: 'English',
    ttsLang: 'en-IN',
    speechLang: 'en-IN',
    voice: 'Google.en-IN-Standard-A',
    menuPrompt: 'Press 1 for Kannada, 2 for Hindi, 3 for English, 4 for Tamil.',
    greeting: 'Hello, you have reached the 1092 helpline. How can I help you today?',
    prompt: 'How can I help you today?',
    continuePrompt: 'Go ahead, I am listening.',
    reprompt: 'Sorry, I did not catch that. Please say that again.',
    fallback: 'Sorry, I am having trouble right now. Please try again.',
    unclearReprompt: 'Sorry, I didn\'t hear that clearly. Can you say it again?',
    escalationMessage: 'It seems you want to speak to a human agent. Please hold on.',
    topicDriftMessage: 'We are currently discussing divorce. Shall we continue with that?',
    clarificationPrompt: 'Okay, how else can I help you?',
    yesNoPrompt: 'Please say just \'yes\' or \'no\'.',
    unclearYesNoPrompt: 'Sorry, I\'m not sure I understood. Could you say \'yes\' or \'no\'?',
    divorceConfirmation: 'Are you talking about divorce?',
    humanTransferPrompt: 'Would you like to speak to a human agent directly?',
    partiallyCorrectPrompt: 'Okay, I partially understood. Please tell me which part was wrong.',
    restatementPrefix: 'Here is what I understood: ',
    restatementSuffix: '. Is that correct?',
    speechHints: 'saree,gift,sister,function,shop,wedding,divorce,yes,no,kind of,somewhat,help,complaint,officer,police,water,road,electricity,hospital,school,pension,corruption,bribe'
  },
  '4': {
    code: 'ta-IN',
    name: 'Tamil',
    ttsLang: 'ta-IN',
    speechLang: 'ta-IN',
    voice: 'Google.ta-IN-Standard-A',
    menuPrompt: 'கன்னடத்திற்கு 1, இந்திக்கு 2, ஆங்கிலத்திற்கு 3, தமிழுக்கு 4 அழுத்தவும்.',
    greeting: 'வணக்கம், நீங்கள் 1092 உதவி எண்ணை தொடர்பு கொண்டுள்ளீர்கள். நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?',
    prompt: 'நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?',
    continuePrompt: 'சொல்லுங்கள், நான் கேட்கிறேன்.',
    reprompt: 'மன்னிக்கவும், நான் கேட்கவில்லை. தயவுசெய்து மீண்டும் சொல்லுங்கள்.',
    fallback: 'மன்னிக்கவும், நான் இப்போது சில சிக்கல்களை எதிர்கொள்கிறேன். தயவுசெய்து மீண்டும் முயற்சிக்கவும்.',
    unclearReprompt: 'மன்னிக்கவும், தெளிவாக கேட்கவில்லை. மீண்டும் சொல்ல முடியுமா?',
    escalationMessage: 'நீங்கள் ஒருவருடன் பேச விரும்புகிறீர்கள் போல தெரிகிறது. தயவுசெய்து காத்திருக்கவும்.',
    topicDriftMessage: 'இப்போது நாம் விவாகரத்து விஷயத்தில்தான் பேசிக்கொண்டு இருக்கிறோம். அதைப்பற்றி தொடரலாமா?',
    clarificationPrompt: 'சரி, வேறு எப்படி உங்களுக்கு உதவலாம்?',
    yesNoPrompt: 'தயவுசெய்து \'ஆம்\' அல்லது \'இல்லை\' மட்டும் சொல்லுங்கள்.',
    unclearYesNoPrompt: 'மன்னிக்கவும், உறுதியாக புரியவில்லை. நீங்கள் \'ஆம்\' அல்லது \'இல்லை\' என்று சொல்ல முடியுமா?',
    divorceConfirmation: 'நீங்கள் விவாகரத்து பற்றி பேசுகிறீர்களா?',
    humanTransferPrompt: 'நீங்கள் நேரடியாக ஒருவருடன் பேச விரும்புகிறீர்களா?',
    partiallyCorrectPrompt: 'சரி, நான் ஓரளவு புரிந்துகொண்டேன். எந்த பகுதி தவறு என்று சொல்லுங்கள்.',
    restatementPrefix: 'நான் புரிந்துகொண்டது இதுதான்: ',
    restatementSuffix: '. இது சரியா?',
    speechHints: 'புடவை,சாரி,பரிசு,அக்கா,விழா,கடை,கல்யாணம்,டைவர்ஸ்,விவாகரத்து,ஆம்,ஆமா,சரி,இல்லை,இல்ல,வேணாம்,ஓரளவு,உதவி,புகார்,அதிகாரி,போலீஸ்,தண்ணீர்,சாலை,மின்சாரம்,மருத்துவமனை,பள்ளி,ஓய்வூதியம்,ஏதாச்சு,பேசுங்க,சொல்லுங்க,கொஞ்சம்,ரோடு,கரெண்ட்,ஓகே'
  }
};

const languageByCode = Object.values(languageMap).reduce((accumulator, entry) => {
  accumulator[entry.code] = entry;
  return accumulator;
}, {});

function getLanguage(digit) {
  const entry = languageMap[digit];
  if (!entry) return null;
  return { ...entry };
}

function getMenuPrompts() {
  return Object.values(languageMap).map((entry) => ({
    code: entry.ttsLang,
    voice: entry.voice,
    menuPrompt: entry.menuPrompt
  }));
}

function getConversationCopy(languageCode) {
  const entry = languageByCode[languageCode] || languageMap['1'];
  return {
    ...entry,
    languageCode: entry.code // backward compatibility
  };
}

function isSupportedLanguage(languageCode) {
  return Boolean(languageByCode[languageCode]);
}

module.exports = {
  getLanguage,
  getMenuPrompts,
  getConversationCopy,
  isSupportedLanguage
};
