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

function pickVoice(lang, overrideName = null) {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (overrideName) {
    const match = voices.find(v => v.name === overrideName);
    if (match) return match;
  }
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
 * useTTS(voiceOverrides)
 * @param {{ 'en-US'?: string, 'ko-KR'?: string }} voiceOverrides - 사용자 선택 음성 이름
 */
export function useTTS(voiceOverrides = {}) {
  const voiceCache = useRef({});
  const overridesRef = useRef(voiceOverrides);

  useEffect(() => {
    overridesRef.current = voiceOverrides;
    // 오버라이드 변경 시 캐시 초기화
    voiceCache.current = {};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOverrides['en-US'], voiceOverrides['ko-KR']]);

  // voices 비동기 로드 대응
  useEffect(() => {
    const cache = () => {
      voiceCache.current = {};
      ['ko-KR', 'en-US'].forEach(lang => {
        const override = overridesRef.current?.[lang];
        const v = pickVoice(lang, override);
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
      // 매번 최신 오버라이드로 캐시 업데이트
      const override = overridesRef.current?.[lang];
      const v = pickVoice(lang, override);
      if (v) voiceCache.current[lang] = v;
      return webSpeechSpeak(text, lang, rate, voiceCache);
    },
    [stop]
  );

  return { speak, stop };
}

// ── 유틸: 기기에서 사용 가능한 음성 목록 반환 ──────────────────────
export function getAvailableVoices() {
  if (!window.speechSynthesis) return { en: [], ko: [] };
  const voices = window.speechSynthesis.getVoices();
  return {
    en: voices.filter(v => v.lang.startsWith('en')),
    ko: voices.filter(v => v.lang.startsWith('ko')),
  };
}
