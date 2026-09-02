import { useRef, useCallback, useEffect } from 'react';

// ── Google Cloud TTS 설정 ────────────────────────────────────────
const CLOUD_VOICE = {
  'ko-KR': { languageCode: 'ko-KR', name: 'ko-KR-Standard-A', ssmlGender: 'FEMALE' },
  'en-US': { languageCode: 'en-US', name: 'en-US-Standard-D', ssmlGender: 'MALE'   },
};

async function cloudTTSFetch(text, lang, rate, apiKey) {
  const voice = CLOUD_VOICE[lang] ?? CLOUD_VOICE['en-US'];
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice,
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: rate,
          pitch: 0,
          effectsProfileId: ['headphone-class-device'],
        },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Cloud TTS HTTP ${res.status}`);
  }
  const { audioContent } = await res.json();
  return `data:audio/mp3;base64,${audioContent}`;
}

// ── Web Speech API 폴백 ───────────────────────────────────────────
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
  const voices = window.speechSynthesis.getVoices();
  const cands  = voices.filter(v => v.lang.startsWith(lang.split('-')[0]));
  for (const pred of VOICE_PRIORITY[lang] ?? [() => true]) {
    const v = cands.find(v => pred(v.name));
    if (v) return v;
  }
  return cands[0] ?? null;
}

function webSpeechSpeak(text, lang, rate, voiceCache) {
  return new Promise(resolve => {
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang  = lang;
    utt.rate  = rate;
    const v   = voiceCache.current[lang] ?? pickVoice(lang);
    if (v) { utt.voice = v; voiceCache.current[lang] ??= v; }
    utt.onend   = resolve;
    utt.onerror = resolve;
    window.speechSynthesis.speak(utt);
  });
}

// ── 오디오 재생 헬퍼 ──────────────────────────────────────────────
function playDataUrl(url, audioRef) {
  return new Promise(resolve => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { audioRef.current = null; resolve(); };
    audio.onerror = () => { audioRef.current = null; resolve(); };
    audio.play().catch(resolve);
  });
}

// ── 메인 훅 ──────────────────────────────────────────────────────
/**
 * useTTS(apiKey?)
 *
 * 우선순위:
 *  1. Google Cloud TTS WaveNet  (월 100만 자 무료, 고품질)
 *  2. Web Speech API            (폴백, 브라우저 내장)
 */
export function useTTS(apiKey) {
  const audioRef   = useRef(null);
  const voiceCache = useRef({});

  // voices 비동기 로드 대응
  useEffect(() => {
    const cache = () => {
      voiceCache.current = {};
      ['ko-KR', 'en-US'].forEach(lang => {
        const v = pickVoice(lang);
        if (v) {
          voiceCache.current[lang] = v;
          console.info(`[TTS] fallback 음성 준비: ${lang} → "${v.name}"`);
        }
      });
    };
    cache();
    window.speechSynthesis.onvoiceschanged = cache;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(
    async (text, lang, rate = 1.0) => {
      stop();

      if (apiKey) {
        try {
          const url = await cloudTTSFetch(text, lang, rate, apiKey);
          return playDataUrl(url, audioRef);
        } catch (e) {
          console.warn('[TTS] Cloud TTS 실패 → Web Speech API 사용:', e.message);
          console.info('[TTS] Cloud TTS 활성화 방법: https://console.cloud.google.com/apis/library/texttospeech.googleapis.com');
        }
      }

      // 폴백: Web Speech API
      return webSpeechSpeak(text, lang, rate, voiceCache);
    },
    [apiKey, stop]
  );

  return { speak, stop };
}
