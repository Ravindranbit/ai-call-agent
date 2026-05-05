function detectEmotion(text, intent) {
  if (!text || text.trim().length === 0) return 'confused';

  text = text.toLowerCase();

  // Normalize repeats + spaces
  text = text.replace(/(.)\\1{2,}/g, '$1$1').replace(/\s{2,}/g, ' ').trim();

  // 1. Intent override
  if (intent === 'legal_divorce') {
    return 'distress';
  }

  // 2. Polite neutral continuation
  if (/^(சரி|ஹம்|ok|okay|ಸರಿ|ठीक है)\\b[.\\s]*$/i.test(text)) {
    return 'neutral';
  }

  // 3. Silent agreement
  if (/^(hmm+|mmm+|uh+)\\b/.test(text)) {
    return 'neutral';
  }

  // 4. Positive confirmation
  const isPositive = /(ஆம்|yes|correct|சரி தான்|ಹೌದು|हाँ|ಸರಿ)/.test(text);
  if (
    isPositive &&
    !/(stress|problem|sad|கஷ்டம்|பிரச்சனை|ತೊಂದರೆ|ಕಷ್ಟ|परेशानी|तकलीफ)/.test(text)
  ) {
    return 'neutral';
  }

  // 5. URGENCY — time-sensitive / emergency
  if (/(urgent|emergency|immediately|right now|hurry|jaldi|ತುರ್ತು|ಬೇಗ|ಬೇಗನೆ|ಅಪಘಾತ|ಬೆಂಕಿ|तुरंत|जल्दी|आपातकाल|ஜாலா|அவசரம்|உடனடியாக|fire|accident|bleeding|dying)/.test(text)) {
    return 'urgency';
  }

  // 6. FEAR — threat, danger, scared
  if (/(afraid|scared|fear|threat|danger|ಭಯ|ಹೆದರಿಕೆ|ಅಪಾಯ|ಬೆದರಿಕೆ|डर|भय|खतरा|धमकी|பயம்|அச்சம்|ஆபத்து|மிரட்டல்)/.test(text)) {
    return 'fear';
  }

  // 7. Angry
  if (/(கோபம்|எரிச்சல்|angry|annoyed|irritated|ಕೋಪ|ಸಿಟ್ಟು|ಕಿರಿಕಿರಿ|गुस्सा|नाराज़|चिढ़)/.test(text)) {
    return 'angry';
  }

  // 8. Confused — multilingual
  if (
    /(^|\\s)(எப்படி|என்ன செய்வது|புரியல|தெரியல|எனக்கு தெரியல|ஹா)(\\s|$)/.test(text) ||
    /^(what|என்ன)\\b[.\\s]*$/.test(text) ||
    /(ಗೊತ್ತಿಲ್ಲ|ಅರ್ಥವಾಗಲಿಲ್ಲ|ಏನು ಮಾಡಬೇಕು|ಹೇಗೆ|समझ नहीं आया|क्या करें|पता नहीं)/.test(text)
  ) {
    return 'confused';
  }

  // 9. High distress — multilingual
  if (/(ರೊಂಬ\s*){1,2}ಕಷ್ಟ|ತುಂಬಾ\s*ಕಷ್ಟ|(ரொம்ப\s*){1,2}கஷ்டம்|very\s*(very\s*)?stressed|(very\s*){2,}(bad|stressed)|romba\s*kashtam|बहुत\s*(बहुत\s*)?तकलीफ/i.test(text)) {
    return 'high_distress';
  }

  // 10. Distress — multilingual
  const helpIsDistress =
    /(உதவி|help|பண்ணுங்க|ಸಹಾಯ|ಬೇಕು|मदद|सहायता)/.test(text) &&
    intent === 'general' &&
    !/(choose|select|pick)/i.test(text);

  if (
    /(பிரச்சனை|சிரமம்|கஷ்டம்|வேதனை|கவலை|முடியல|சரி இல்லை|not good|not feeling good|very bad|bad|sad|stress|problem|tension|மன்னிக்கவும்|sorry|ತೊಂದರೆ|ಕಷ್ಟ|ಸಮಸ್ಯೆ|ನೋವು|ಬೇಸರ|ಚಿಂತೆ|परेशानी|तकलीफ|दुख|चिंता|मुसीबत)/.test(text) ||
    helpIsDistress
  ) {
    return 'distress';
  }

  // 11. Happy (context-aware)
  const isThanking = /(thanks|thank you|நன்றி|ಧನ್ಯವಾದ|धन्यवाद|शुक्रिया)/.test(text);
  if (
    isThanking &&
    !/(stress|problem|sad|கஷ்டம்|பிரச்சனை|ತೊಂದರೆ|परेशानी)/.test(text)
  ) {
    return 'happy';
  }

  // 11.5 Light positive (laugh)
  if (/(haha|lol|ஹா ஹா|ಹಾ ಹಾ)/.test(text)) {
    return 'happy';
  }

  // 12. Recovery
  if (/பரவாயில்லை|fine|ಪರವಾಗಿಲ್ಲ|ठीक है/.test(text)) {
    return 'recovering';
  }

  // 13. Short unclear
  if (text.length < 5) {
    return 'confused';
  }

  return 'neutral';
}

module.exports = { detectEmotion };
