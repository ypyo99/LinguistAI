import { useState, useRef, useEffect, useCallback } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { useTTS } from '../hooks/useTTS';

// ── 유틸 ────────────────────────────────────────────
const SPEED_MAP = { slow: 0.6, normal: 1.0, fast: 1.5 };

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── 라디오 셀렉트 스타일 ────────────────────────────
const radioBase =
  'px-2 sm:px-md py-2 sm:py-sm rounded-lg border cursor-pointer select-none text-center ' +
  'border-outline-variant dark:border-outline ' +
  'text-on-surface-variant dark:text-on-dark-surface-variant ' +
  'text-xs sm:text-label-md transition-colors ' +
  'peer-checked:bg-primary-fixed dark:peer-checked:bg-primary ' +
  'peer-checked:border-primary-container dark:peer-checked:border-inverse-primary ' +
  'peer-checked:text-primary-container dark:peer-checked:text-inverse-primary';

function RadioGroup({ name, options, value, onChange }) {
  return (
    <div className={`grid gap-2 grid-cols-${options.length}`}>
      {options.map(({ val, label, icon }) => (
        <label key={val} className="text-center">
          <input
            className="peer sr-only"
            type="radio"
            name={name}
            value={val}
            checked={value === val}
            onChange={() => onChange(val)}
          />
          <div className={`${radioBase} flex items-center justify-center gap-1`}>
            {icon && <span className="material-symbols-outlined text-base">{icon}</span>}
            {label}
          </div>
        </label>
      ))}
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────
export default function StudyTab({ sentences = [], apiKey }) {
  const [showSettings, setShowSettings] = usePersistentState('linguist-study-settings', true);
  const [showList, setShowList] = usePersistentState('linguist-study-list', true);

  // 재생 설정
  const [speed, setSpeed]       = usePersistentState('linguist-study-speed', 'normal');
  const [mode, setMode]         = usePersistentState('linguist-study-mode', 'sequential');
  const [langOrder, setLangOrder] = usePersistentState('linguist-study-lang', 'en-ko');
  const [repeat, setRepeat]     = usePersistentState('linguist-study-repeat', 1);

  // 재생 상태
  const [isPlaying, setIsPlaying]     = useState(false);   // 전체 재생 중
  const [currentIdx, setCurrentIdx]   = useState(null);    // 전체 재생 중 현재 인덱스
  const [singleIdx, setSingleIdx]     = useState(null);    // 개별 재생 중 인덱스

  const shouldStop = useRef(false);
  const singleStop = useRef(false);

  const { speak: ttsSpeak, stop: ttsStop } = useTTS(apiKey);

  // 언마운트 시 TTS 정리
  useEffect(() => {
    return () => { ttsStop(); };
  }, [ttsStop]);

  // ── TTS 헬퍼 (useTTS 훅 위임) ────────────────────────

  // 한 문장을 (언어 순서 + 속도) 에 맞게 재생
  const speakSentence = useCallback(async (sentence, rate, stopRef) => {
    const pairs = langOrder === 'en-ko'
      ? [{ text: sentence.en, lang: 'en-US' }, { text: sentence.ko, lang: 'ko-KR' }]
      : [{ text: sentence.ko, lang: 'ko-KR' }, { text: sentence.en, lang: 'en-US' }];

    for (const { text, lang } of pairs) {
      if (stopRef.current) return;
      await ttsSpeak(text, lang, rate);
      if (stopRef.current) return;
      await delay(350);
    }
  }, [langOrder, ttsSpeak]);

  // ── 개별 재생 ──────────────────────────────────────
  const handlePlayOne = useCallback(async (idx) => {
    // 이미 재생 중인 항목 클릭 → 정지
    if (singleIdx === idx) {
      singleStop.current = true;
      ttsStop();
      setSingleIdx(null);
      return;
    }
    // 이전 재생 중단
    singleStop.current = true;
    ttsStop();
    await delay(100);
    singleStop.current = false;

    setSingleIdx(idx);
    const rate = SPEED_MAP[speed];

    await speakSentence(sentences[idx], rate, singleStop);
    setSingleIdx(null);
  }, [singleIdx, speed, sentences, speakSentence]);

  // ── 전체 재생 ──────────────────────────────────────
  const handlePlayAll = useCallback(async () => {
    // 재생 중이면 정지
    if (isPlaying) {
      shouldStop.current = true;
      ttsStop();
      setIsPlaying(false);
      setCurrentIdx(null);
      return;
    }
    if (sentences.length === 0) return;

    // 개별 재생 중이면 중단
    singleStop.current = true;
    ttsStop();
    setSingleIdx(null);
    await delay(100);

    shouldStop.current = false;
    setIsPlaying(true);
    const rate = SPEED_MAP[speed];
    const list = mode === 'random' ? shuffle(sentences) : [...sentences];
    const origIndices = list.map(s => sentences.indexOf(s));

    for (let i = 0; i < list.length; i++) {
      if (shouldStop.current) break;
      setCurrentIdx(origIndices[i]);

      for (let r = 0; r < repeat; r++) {
        if (shouldStop.current) break;
        await speakSentence(list[i], rate, shouldStop);
        if (!shouldStop.current && r < repeat - 1) await delay(300);
      }

      if (!shouldStop.current && i < list.length - 1) await delay(600);
    }

    setIsPlaying(false);
    setCurrentIdx(null);
    shouldStop.current = false;
  }, [isPlaying, sentences, speed, mode, repeat, speakSentence]);

  // ── 렌더 ──────────────────────────────────────────
  return (
    <div className="tab-fade-in">
      <div className="flex flex-col md:grid md:grid-cols-12 gap-4 sm:gap-lg">

        {/* ── 재생 설정 ── */}
        <div className="md:col-span-4 flex flex-col gap-4 sm:gap-lg">
          <section className="bg-surface-container-lowest dark:bg-dark-surface rounded-xl shadow-sm border border-outline-variant dark:border-outline p-4 sm:p-lg transition-colors duration-200">
            <button
              className="w-full flex justify-between items-center text-on-surface dark:text-on-dark-surface mb-3 sm:mb-md"
              onClick={() => setShowSettings(v => !v)}
              aria-expanded={showSettings}
            >
              <div className="flex items-center gap-2 text-base sm:text-title-md font-semibold">
                <span className="material-symbols-outlined text-xl">tune</span>
                재생 설정
              </div>
              <span
                className="material-symbols-outlined transition-transform duration-200"
                style={{ transform: showSettings ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                expand_more
              </span>
            </button>

            {showSettings && (
              <div className="space-y-3 sm:space-y-md">
                {/* 반복 횟수 */}
                <div className="flex flex-col gap-1 sm:gap-base">
                  <label className="text-xs sm:text-label-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant" htmlFor="repeat">
                    반복 횟수
                  </label>
                  <input
                    className="w-full h-10 sm:h-11 px-3 sm:px-md rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring transition-colors duration-200 text-sm sm:text-base"
                    id="repeat" max="5" min="1" type="number"
                    value={repeat}
                    onChange={e => setRepeat(Math.max(1, Math.min(5, Number(e.target.value))))}
                  />
                </div>

                {/* 재생 속도 */}
                <div className="flex flex-col gap-1 sm:gap-base">
                  <span className="text-xs sm:text-label-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant">재생 속도</span>
                  <RadioGroup
                    name="speed"
                    value={speed}
                    onChange={setSpeed}
                    options={[
                      { val: 'slow',   label: '느림' },
                      { val: 'normal', label: '보통' },
                      { val: 'fast',   label: '빠름' },
                    ]}
                  />
                </div>

                {/* 재생 모드 */}
                <div className="flex flex-col gap-1 sm:gap-base">
                  <span className="text-xs sm:text-label-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant">재생 모드</span>
                  <RadioGroup
                    name="mode"
                    value={mode}
                    onChange={setMode}
                    options={[
                      { val: 'sequential', label: '순차', icon: 'format_list_numbered' },
                      { val: 'random',     label: '랜덤', icon: 'shuffle' },
                    ]}
                  />
                </div>

                {/* 언어 순서 */}
                <div className="flex flex-col gap-1 sm:gap-base">
                  <span className="text-xs sm:text-label-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant">언어 순서</span>
                  <select
                    className="w-full h-10 sm:h-11 px-3 sm:px-md rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring transition-colors duration-200 text-sm sm:text-base"
                    value={langOrder}
                    onChange={e => setLangOrder(e.target.value)}
                  >
                    <option value="en-ko">영어 → 한국어</option>
                    <option value="ko-en">한국어 → 영어</option>
                  </select>
                </div>
              </div>
            )}
          </section>

          {/* 전체 재생 버튼 */}
          <button
            onClick={handlePlayAll}
            disabled={sentences.length === 0}
            className={`w-full h-12 rounded-xl font-medium text-sm sm:text-label-md active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed
              ${isPlaying
                ? 'bg-error text-on-error hover:bg-error/90'
                : 'bg-primary-container text-on-primary hover:bg-primary'}`}
          >
            <span className="material-symbols-outlined text-xl">
              {isPlaying ? 'stop_circle' : 'play_circle'}
            </span>
            {isPlaying ? '재생 중지' : '전체 재생'}
          </button>
        </div>

        {/* ── 재생 목록 ── */}
        <div className="md:col-span-8 flex flex-col gap-4 sm:gap-lg">
          <section className="bg-surface-container-lowest dark:bg-dark-surface rounded-xl shadow-sm border border-outline-variant dark:border-outline p-4 sm:p-lg transition-colors duration-200">
            <button
              className="w-full flex justify-between items-center text-on-surface dark:text-on-dark-surface mb-3 sm:mb-md"
              onClick={() => setShowList(v => !v)}
              aria-expanded={showList}
            >
              <div className="flex items-center gap-2 text-base sm:text-title-md font-semibold">
                <span className="material-symbols-outlined text-xl">playlist_play</span>
                재생 목록 <span className="text-xs sm:text-label-sm font-normal opacity-60">({sentences.length}개)</span>
              </div>
              <span
                className="material-symbols-outlined transition-transform duration-200"
                style={{ transform: showList ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                expand_more
              </span>
            </button>

            {showList && (
              <>
                {sentences.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-on-surface-variant dark:text-on-dark-surface-variant gap-2">
                    <span className="material-symbols-outlined text-4xl opacity-30">playlist_add</span>
                    <p className="text-sm opacity-60">생성 탭에서 문장을 만들어보세요.</p>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-sm">
                    {sentences.map((s, idx) => {
                      const isThis = currentIdx === idx || singleIdx === idx;
                      const isThisSingle = singleIdx === idx;
                      return (
                        <div
                          key={idx}
                          className={`group rounded-xl p-3 sm:p-md flex items-start gap-3 sm:gap-md transition-all border
                            ${isThis
                              ? 'border-primary dark:border-inverse-primary bg-primary-fixed/40 dark:bg-primary/20'
                              : 'border-outline-variant dark:border-outline hover:border-secondary dark:hover:border-inverse-primary hover:bg-surface-variant dark:hover:bg-dark-surface-bright'}`}
                        >
                          <button
                            onClick={() => handlePlayOne(idx)}
                            className={`shrink-0 mt-0.5 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all touch-target
                              ${isThis
                                ? 'bg-primary text-on-primary scale-110'
                                : 'bg-surface-container-high dark:bg-dark-surface-bright text-primary dark:text-inverse-primary group-hover:bg-primary-fixed dark:group-hover:bg-primary'}`}
                            aria-label={isThisSingle ? '재생 중지' : '재생'}
                          >
                            <span className="material-symbols-outlined text-base sm:text-xl">
                              {isThisSingle ? 'stop' : 'play_arrow'}
                            </span>
                          </button>
                          <div className="flex-grow space-y-1 sm:space-y-xs min-w-0">
                            <p className={`text-sm sm:text-body-lg font-medium leading-snug break-words ${isThis ? 'text-primary dark:text-inverse-primary' : 'text-on-surface dark:text-on-dark-surface'}`}>
                              {s.en}
                            </p>
                            <p className="text-xs sm:text-body-md text-on-surface-variant dark:text-on-dark-surface-variant leading-snug break-words">
                              {s.ko}
                            </p>
                          </div>
                          {/* 재생 중 인디케이터 */}
                          {isThis && (
                            <div className="shrink-0 flex items-center gap-0.5 mt-1">
                              {[1,2,3].map(i => (
                                <div
                                  key={i}
                                  className="w-0.5 bg-primary dark:bg-inverse-primary rounded-full animate-bounce"
                                  style={{ height: '12px', animationDelay: `${i * 0.15}s` }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>

          {/* 하단 전체 재생 버튼 (목록 아래) */}
          <button
            onClick={handlePlayAll}
            disabled={sentences.length === 0}
            className={`w-full h-12 rounded-xl font-medium text-sm sm:text-label-md active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed
              ${isPlaying
                ? 'bg-error text-on-error hover:bg-error/90'
                : 'bg-primary-container text-on-primary hover:bg-primary'}`}
          >
            <span className="material-symbols-outlined text-xl">
              {isPlaying ? 'stop_circle' : 'play_circle'}
            </span>
            {isPlaying ? '재생 중지' : '전체 재생'}
          </button>
        </div>
      </div>
    </div>
  );
}
