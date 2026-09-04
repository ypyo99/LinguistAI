import { useRef, useCallback, useEffect } from 'react';

// ── Google Cloud TTS 음성 목록 ────────────────────────────────────
export const GOOGLE_VOICES = {
  'en-US': [
    { name: 'en-US-Neural2-C', label: '여성 C', gender: 'female' },
    { name: 'en-US-Neural2-F', label: '여성 F', gender: 'female' },
    { name: 'en-US-Neural2-A', label: '남성 A', gender: 'male' },
    { name: 'en-US-Neural2-D', label: '남성 D', gender: 'male' },
  ],
  'ko-KR': [
    { name: 'ko-KR-Neural2-A', label: '여성 A', gender: 'female' },
    { name: 'ko-KR-Neural2-B', label: '여성 B', gender: 'female' },
    { name: 'ko-KR-Neural2-D', label: '여성 D', gender: 'female' },
    { name: 'ko-KR-Neural2-C', label: '남성 C', gender: 'male' },
  ],
};

// ── Google Cloud TTS API 호출 ─────────────────────────────────────
async function googleTTSSpeak(text, lang, rate, ttsApiKey, voiceName, audioCtxRef, currentSourceRef) {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsApiKey}`;
  const body = {
    input: { text },
    voice: { languageCode: lang, name: voiceName },
    audioConfig: { audioEncoding: 'MP3', speakingRate: rate },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Google TTS API 오류: ${res.status} - ${err?.error?.message || res.statusText}`);
  }

  const data = await res.json();
  const binary = atob(data.audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }
  const ctx = audioCtxRef.current;
  if (ctx.state === 'suspended') await ctx.resume();

  const audioBuffer = await ctx.decodeAudioData(bytes.buffer);

  return new Promise((resolve) => {
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    currentSourceRef.current = source;
    source.onended = () => { currentSourceRef.current = null; resolve(); };
    source.start(0);
  });
}

// ── Web Speech API 폴백 ───────────────────────────────────────────
const VOICE_PRIORITY = {
  'ko-KR': [
    n => n === 'Google 한국어',
    n => n.toLowerCase().includes('google') && n.toLowerCase().includes('ko'),
    n => n.toLowerCase().includes('seoyeon'),
    () => true,
  ],
  'en-US': [
    n => n === 'Google US English',
    n => n.toLowerCase().includes('google') && n.toLowerCase().includes('us'),
    () => true,
  ],
};

function pickVoice(lang) {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const cands = voices.filter(v => v.lang.startsWith(lang.split('-')[0]));
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
    utt.lang = lang;
    utt.rate = rate;
    const v = voiceCache.current[lang] || pickVoice(lang);
    if (v) { utt.voice = v; if (!voiceCache.current[lang]) voiceCache.current[lang] = v; }
    utt.onend = resolve;
    utt.onerror = resolve;
    if (window.speechSynthesis) window.speechSynthesis.speak(utt);
    else resolve();
  });
}

// ── 메인 훅 ──────────────────────────────────────────────────────
/**
 * useTTS(ttsApiKey, voiceEn, voiceKo)
 * @param {string} ttsApiKey - Google Cloud TTS API 키 (없으면 Web Speech API 사용)
 * @param {string} voiceEn   - 영어 음성 이름 (예: 'en-US-Neural2-C')
 * @param {string} voiceKo   - 한국어 음성 이름 (예: 'ko-KR-Neural2-A')
 */
export function useTTS(ttsApiKey = '', voiceEn = 'en-US-Neural2-C', voiceKo = 'ko-KR-Neural2-A') {
  const voiceCache = useRef({});
  const audioCtxRef = useRef(null);
  const currentSourceRef = useRef(null);

  useEffect(() => {
    const cache = () => {
      voiceCache.current = {};
      ['ko-KR', 'en-US'].forEach(lang => {
        const v = pickVoice(lang);
        if (v) voiceCache.current[lang] = v;
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
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch (_) {}
      currentSourceRef.current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(
    async (text, lang, rate = 1.0) => {
      stop();
      if (ttsApiKey) {
        const voiceName = lang === 'ko-KR' ? voiceKo : voiceEn;
        try {
          await googleTTSSpeak(text, lang, rate, ttsApiKey, voiceName, audioCtxRef, currentSourceRef);
          return;
        } catch (e) {
          console.warn('[TTS] Google Cloud TTS 실패, Web Speech API로 폴백:', e.message);
        }
      }
      return webSpeechSpeak(text, lang, rate, voiceCache);
    },
    [stop, ttsApiKey, voiceEn, voiceKo]
  );

  return { speak, stop };
}
