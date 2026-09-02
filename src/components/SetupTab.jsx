import { useState, useCallback } from 'react';

async function testCloudTTS(apiKey) {
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: '안녕하세요! Google Cloud TTS Standard 테스트입니다.' },
        voice: { languageCode: 'ko-KR', name: 'ko-KR-Standard-A', ssmlGender: 'FEMALE' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, effectsProfileId: ['headphone-class-device'] },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  const { audioContent } = await res.json();
  new Audio(`data:audio/mp3;base64,${audioContent}`).play();
}

export default function SetupTab({ apiKey, onSave, ttsApiKey, onSaveTts }) {
  // Gemini API Key State
  const [input, setInput] = useState(apiKey || '');
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  // Cloud TTS API Key State
  const [ttsInput, setTtsInput] = useState(ttsApiKey || '');
  const [showTts, setShowTts] = useState(false);
  const [ttsSaved, setTtsSaved] = useState(false);

  // TTS Test State
  const [ttsStatus, setTtsStatus] = useState(null); // null | 'testing' | 'ok' | 'error'
  const [ttsError, setTtsError] = useState('');

  const handleSave = () => {
    onSave(input?.trim() || '');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveTts = () => {
    onSaveTts(ttsInput?.trim() || '');
    setTtsSaved(true);
    setTtsStatus(null);
    setTimeout(() => setTtsSaved(false), 2000);
  };

  const handleTestTTS = useCallback(async () => {
    if (!ttsInput?.trim()) return;
    setTtsStatus('testing');
    setTtsError('');
    try {
      await testCloudTTS(ttsInput.trim());
      setTtsStatus('ok');
    } catch (e) {
      setTtsStatus('error');
      setTtsError(e.message);
    }
  }, [ttsInput]);

  return (
    <div className="tab-fade-in flex flex-col gap-4 sm:gap-lg max-w-2xl mx-auto">

      {/* ── 1. Gemini API 키 (문장 생성용) ── */}
      <section className="bg-surface-container-lowest dark:bg-dark-surface rounded-xl shadow-sm border border-outline-variant dark:border-outline p-4 sm:p-lg transition-colors duration-200">
        <h2 className="text-base sm:text-title-md font-semibold mb-4 sm:mb-md flex items-center gap-2 text-on-surface dark:text-on-dark-surface">
          <span className="material-symbols-outlined text-xl">auto_awesome</span>
          Gemini API 키
          <span className="text-xs font-normal text-on-surface-variant dark:text-on-dark-surface-variant ml-1">(문장 생성용)</span>
        </h2>

        <div className="flex flex-col gap-3 sm:gap-md">
          <div className="flex flex-col gap-1 sm:gap-base">
            <div className="flex justify-between items-center">
              <label className="text-xs sm:text-label-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant" htmlFor="apiKey">
                Google AI Studio API 키
              </label>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
                className="text-xs sm:text-label-sm font-medium text-primary dark:text-inverse-primary hover:underline">
                Gemini 키 발급받기 ↗
              </a>
            </div>
            <div className="relative">
              <input
                className="w-full h-10 sm:h-11 px-3 sm:px-md pr-12 rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring placeholder:text-outline-variant dark:placeholder:text-on-dark-surface-variant transition-colors duration-200 text-sm font-mono"
                id="apiKey"
                placeholder="AIzaSy... 또는 AQ.Ab... 형식의 키"
                type={show ? 'text' : 'password'}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                aria-label="키 표시 전환">
                <span className="material-symbols-outlined text-base">{show ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!input?.trim()}
              className={`flex-1 h-10 sm:h-11 px-4 rounded-lg text-sm sm:text-label-md font-medium active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2
                ${saved ? 'bg-green-500 text-white' : 'bg-primary-container text-on-primary hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed'}`}>
              <span className="material-symbols-outlined text-base">{saved ? 'check_circle' : 'save'}</span>
              {saved ? '저장되었습니다!' : '키 저장'}
            </button>
            {apiKey && (
              <button onClick={() => { setInput(''); onSave(''); }}
                className="h-10 sm:h-11 px-4 rounded-lg text-sm sm:text-label-md font-medium active:scale-95 transition-all flex items-center justify-center gap-1 text-error hover:bg-error-container/30 border border-error-container">
                <span className="material-symbols-outlined text-base">delete</span>
                삭제
              </button>
            )}
          </div>
        </div>

        {apiKey && (
          <div className="mt-4 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
            <span className="material-symbols-outlined text-base">check_circle</span>
            Gemini API 키가 설정되어 있습니다.
          </div>
        )}
      </section>

      {/* ── 2. Google Cloud TTS 설정 (음성 재생용) ── */}
      <section className="bg-surface-container-lowest dark:bg-dark-surface rounded-xl shadow-sm border border-outline-variant dark:border-outline p-4 sm:p-lg transition-colors duration-200">
        <h2 className="text-base sm:text-title-md font-semibold mb-1 flex items-center gap-2 text-on-surface dark:text-on-dark-surface">
          <span className="material-symbols-outlined text-xl">record_voice_over</span>
          Google Cloud TTS (Standard)
          <span className="text-xs font-normal text-on-surface-variant dark:text-on-dark-surface-variant ml-1">(고품질 음성 · 월 400만 자 무료)</span>
        </h2>
        <p className="text-xs sm:text-label-sm text-on-surface-variant dark:text-on-dark-surface-variant mb-4">
          Google Cloud Console에서 발급받은 <strong>Google Cloud API 키</strong>를 입력해주세요. (Gemini 키와 다름)
        </p>

        <div className="flex flex-col gap-3 sm:gap-md mb-6">
          <div className="flex flex-col gap-1 sm:gap-base">
            <div className="flex justify-between items-center">
              <label className="text-xs sm:text-label-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant" htmlFor="ttsApiKey">
                Google Cloud API 키
              </label>
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer"
                className="text-xs sm:text-label-sm font-medium text-primary dark:text-inverse-primary hover:underline">
                Cloud 키 발급받기 ↗
              </a>
            </div>
            <div className="relative">
              <input
                className="w-full h-10 sm:h-11 px-3 sm:px-md pr-12 rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring placeholder:text-outline-variant dark:placeholder:text-on-dark-surface-variant transition-colors duration-200 text-sm font-mono"
                id="ttsApiKey"
                placeholder="AIzaSy... 형식의 Cloud API 키"
                type={showTts ? 'text' : 'password'}
                value={ttsInput}
                onChange={e => setTtsInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveTts()}
              />
              <button type="button" onClick={() => setShowTts(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                aria-label="키 표시 전환">
                <span className="material-symbols-outlined text-base">{showTts ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSaveTts} disabled={!ttsInput?.trim()}
              className={`flex-1 h-10 sm:h-11 px-4 rounded-lg text-sm sm:text-label-md font-medium active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2
                ${ttsSaved ? 'bg-green-500 text-white' : 'bg-primary-container text-on-primary hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed'}`}>
              <span className="material-symbols-outlined text-base">{ttsSaved ? 'check_circle' : 'save'}</span>
              {ttsSaved ? 'TTS 키가 저장되었습니다!' : 'Cloud 키 저장'}
            </button>
            {ttsApiKey && (
              <button onClick={() => { setTtsInput(''); onSaveTts(''); setTtsStatus(null); }}
                className="h-10 sm:h-11 px-4 rounded-lg text-sm sm:text-label-md font-medium active:scale-95 transition-all flex items-center justify-center gap-1 text-error hover:bg-error-container/30 border border-error-container">
                <span className="material-symbols-outlined text-base">delete</span>
                삭제
              </button>
            )}
          </div>
        </div>

        {/* 현재 설정된 음성 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-sm mb-4">
          {[
            { lang: '한국어', voice: 'ko-KR-Standard-A', desc: 'Standard 여성 음성 (월 400만 자 무료)', flag: '🇰🇷' },
            { lang: '영어',   voice: 'en-US-Standard-D', desc: 'Standard 남성 음성 (월 400만 자 무료)', flag: '🇺🇸' },
          ].map(({ lang, voice, desc, flag }) => (
            <div key={lang} className="flex items-center gap-3 p-3 rounded-lg bg-surface-variant/30 dark:bg-dark-surface-bright/30 border border-outline-variant/50 dark:border-outline/30">
              <span className="text-2xl">{flag}</span>
              <div>
                <p className="text-xs font-semibold text-on-surface dark:text-on-dark-surface">{lang} — <span className="font-mono">{voice}</span></p>
                <p className="text-xs text-on-surface-variant dark:text-on-dark-surface-variant">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 버튼 */}
        <div className="flex flex-col gap-2 sm:gap-sm mb-3">
          <button onClick={handleTestTTS} disabled={!ttsInput?.trim() || ttsStatus === 'testing'}
            className="w-full h-10 rounded-lg text-sm font-medium border border-primary dark:border-inverse-primary text-primary dark:text-inverse-primary hover:bg-primary-fixed/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40">
            {ttsStatus === 'testing' ? (
              <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>테스트 중...</>
            ) : (
              <><span className="material-symbols-outlined text-base">volume_up</span>Cloud TTS 테스트 재생</>
            )}
          </button>
        </div>

        {/* 테스트 결과 */}
        {ttsStatus === 'ok' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs sm:text-label-sm">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <strong>Cloud TTS 정상 작동!</strong>&nbsp;이제 고품질 한국어 음성으로 학습하실 수 있습니다.
          </div>
        )}
        {ttsStatus === 'error' && (
          <div className="flex flex-col gap-1 p-3 rounded-lg bg-error-container text-on-error-container text-xs sm:text-label-sm">
            <div className="flex items-center gap-2 font-semibold">
              <span className="material-symbols-outlined text-base">error</span>
              Cloud TTS 연결 실패 → 현재 Web Speech API로 재생 중
            </div>
            <p className="ml-6 opacity-80 break-words">{ttsError}</p>
            <p className="ml-6 mt-1">입력하신 <strong>Cloud API 키</strong>가 유효한지, 그리고 <strong>Cloud Text-to-Speech API</strong>가 활성화되어 있는지 확인해 주세요.</p>
          </div>
        )}
      </section>
    </div>
  );
}
