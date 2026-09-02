import { useRef, useCallback, useEffect } from 'react';

// ── Web Speech API ───────────────────────────────────────────
const VOICE_PRIORITY = {
  'ko-KR': [
    n => n === 'Google 한국어',
    n => n.toLowerCase().includes('google') && n.toLowerCase().includes('ko'),
    n => n.toLowerCase().includes('seoyeon'),
    n => n.toLowerCase().includes('heami'),
    () => true,
  ],
  'en-US': [
    n => n === 'Google US English',
    n => n.toLowerCase().includes('google') && n.toLowerCase().includes('us'),
    n => n.toLowerCase().includes('jenny'),
    () => true,
  ],
};

function pickVoice(lang) {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const cands  = voices.filter(v => v.lang.startsWith(lang.split('-')[0]));
  const priorityList = VOICE_PRIORITY[lang] || [() => true];
  for (const pred of priorityList) {
    const v = cands.find(v => pred(v.name));
    if (v) return v;
  }
  return cands[0] || null;
}

function webSpeechSpeak(text, lang, rate, voiceCache) {
  return new Promise(resolve => {
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang  = lang;
    utt.rate  = rate;
    const v   = voiceCache.current[lang] || pickVoice(lang);
    if (v) { 
      utt.voice = v; 
      if (!voiceCache.current[lang]) voiceCache.current[lang] = v;
    }
    utt.onend   = resolve;
    utt.onerror = resolve;
    if (window.speechSynthesis) {
      window.speechSynthesis.speak(utt);
    } else {
      resolve();
    }
  });
}

// ── 메인 훅 ──────────────────────────────────────────────────────
/**
 * useTTS()
 * 기기 내장 Web Speech API 전용
 */
export function useTTS() {
  const voiceCache = useRef({});

  // voices 비동기 로드 대응
  useEffect(() => {
    const cache = () => {
      voiceCache.current = {};
      ['ko-KR', 'en-US'].forEach(lang => {
        const v = pickVoice(lang);
        if (v) {
          voiceCache.current[lang] = v;
          console.info(`[TTS] 준비 완료: ${lang} → "${v.name}"`);
        }
      });
    };
    cache();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = cache;
      return () => { window.speechSynthesis.onvoiceschanged = null; };
    }
    return () => {};
  }, []);

  const stop = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback(
    async (text, lang, rate = 1.0) => {
      stop();
      return webSpeechSpeak(text, lang, rate, voiceCache);
    },
    [stop]
  );

  return { speak, stop };
}
