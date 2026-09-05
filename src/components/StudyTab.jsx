import { useState, useRef, useEffect, useCallback } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { useTTS, GOOGLE_VOICES } from '../hooks/useTTS';
import { useWakeLock } from '../hooks/useWakeLock';

// ── 유틸 ────────────────────────────────────────────
const SPEED_MAP = { slow: 0.6, normal: 1.0, slightly_fast: 1.25, fast: 1.5 };

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
  'px-2 sm:px-md rounded-lg border cursor-pointer select-none text-center ' +
  'border-outline-variant dark:border-outline ' +
  'text-on-surface-variant dark:text-on-dark-surface-variant ' +
  'text-xs sm:text-label-md transition-colors ' +
  'peer-checked:bg-primary-fixed dark:peer-checked:bg-primary ' +
  'peer-checked:border-primary-container dark:peer-checked:border-inverse-primary ' +
  'peer-checked:text-primary-container dark:peer-checked:text-inverse-primary';

function RadioGroup({ name, options, value, onChange }) {
  return (
    <div className="flex gap-2 w-full h-10 sm:h-11">
      {options.map(({ val, label, icon }) => (
        <label key={val} className="flex-1 text-center h-full">
          <input
            className="peer sr-only"
            type="radio"
            name={name}
            value={val}
            checked={value === val}
            onChange={() => onChange(val)}
          />
          <div className={`${radioBase} h-full flex items-center justify-center gap-1`}>
            {icon && <span className="material-symbols-outlined text-base">{icon}</span>}
            {label}
          </div>
        </label>
      ))}
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────
export default function StudyTab({ sentences = [], apiKey, ttsApiKey = '', setStudiedIndices, studiedIndices, favorites, setFavorites, onSavePack }) {
  const [showSettings, setShowSettings] = usePersistentState('linguist-study-settings', false);
  const [showList, setShowList] = usePersistentState('linguist-study-list', true);
  const favoritesRef = useRef(favorites);
  useEffect(() => { favoritesRef.current = favorites; }, [favorites]);
  const [isCommuteMode, setIsCommuteMode] = useState(false);
  const [commuteBrightness, setCommuteBrightness] = usePersistentState('linguist-commute-brightness', 1.0);

  const [speed, setSpeed]       = usePersistentState('linguist-study-speed', 'normal');
  const [mode, setMode]         = usePersistentState('linguist-study-mode', 'sequential');
  const [langOrder, setLangOrder] = usePersistentState('linguist-study-lang', 'en-ko');
  const [repeat, setRepeat]     = usePersistentState('linguist-study-repeat', 1);
  const [voiceEn, setVoiceEn]   = usePersistentState('linguist-voice-en', 'en-US-Neural2-C');
  const [voiceKo, setVoiceKo]   = usePersistentState('linguist-voice-ko', 'ko-KR-Neural2-A');

  const [localVoices, setLocalVoices] = useState({ en: [], ko: [] });
  useEffect(() => {
    const updateVoices = () => {
      if (!window.speechSynthesis) return;
      const voices = window.speechSynthesis.getVoices();
      setLocalVoices({
        en: voices.filter(v => v.lang.startsWith('en')),
        ko: voices.filter(v => v.lang.startsWith('ko'))
      });
    };
    if (window.speechSynthesis) {
      updateVoices();
      window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    }
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
    };
  }, []);

  const settingsRef = useRef({ speed, mode, repeat, langOrder, voiceEn, voiceKo });
  const prevSettingsRef = useRef({ speed, mode, repeat, langOrder, voiceEn, voiceKo });
  useEffect(() => {
    settingsRef.current = { speed, mode, repeat, langOrder, voiceEn, voiceKo };
  }, [speed, mode, repeat, langOrder, voiceEn, voiceKo]);

  // 재생 설정 패널 자동 닫기 (30초, 드롭다운 선택 중에는 중단)
  const [isFocusedInSettings, setIsFocusedInSettings] = useState(false);
  useEffect(() => {
    let timer;
    if (showSettings && !isFocusedInSettings) {
      timer = setTimeout(() => {
        setShowSettings(false);
      }, 30000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showSettings, isFocusedInSettings, setShowSettings]);

  // 재생 상태
  const [isPlaying, setIsPlaying]     = useState(false);   // 전체 재생 중
  const [currentIdx, setCurrentIdx]   = useState(null);    // 전체 재생 중 현재 인덱스
  const [singleIdx, setSingleIdx]     = useState(null);    // 개별 재생 중 인덱스
  const [currentRepeat, setCurrentRepeat] = useState(0);   // 현재 반복 회차
  const [isWaiting, setIsWaiting]     = useState(false);   // 따라 말하기 인터벌 대기 중 여부

  const shouldStop = useRef(false);
  const singleStop = useRef(false);
  const currentListRef = useRef(null);
  const playRunId = useRef(0);

  const { speak: ttsSpeak, stop: ttsStop, ttsStatus } = useTTS(ttsApiKey, voiceEn, voiceKo);
  useWakeLock(isPlaying || singleIdx !== null || isCommuteMode);

  // 언마운트 시 TTS 정리
  useEffect(() => {
    return () => { ttsStop(); };
  }, [ttsStop]);


  // ── TTS 헬퍼 (useTTS 훅 위임) ────────────────────────
  const speakSentence = useCallback(async (sentence, rate, stopRef, repeatIndex = 0) => {
    let pairs = settingsRef.current.langOrder === 'en-ko'
      ? [{ text: sentence.en, lang: 'en-US' }, { text: sentence.ko, lang: 'ko-KR' }]
      : [{ text: sentence.ko, lang: 'ko-KR' }, { text: sentence.en, lang: 'en-US' }];

    // 한국어 문장은 첫 번째 재생(repeatIndex === 0)에서만 재생하고 이후 반복에서는 제외
    if (repeatIndex > 0) {
      pairs = pairs.filter(p => p.lang !== 'ko-KR');
    }

    for (const { text, lang } of pairs) {
      if (stopRef.current) return;
      await ttsSpeak(text, lang, rate);
      if (stopRef.current) return;
      await delay(350);
    }
  }, [ttsSpeak]);


  // ── 전체 재생 ──────────────────────────────────────
  const handlePlayAll = useCallback(async (startFromIdx = null, onlyFavorites = false) => {
    let isJump = typeof startFromIdx === 'number';

    // 재생 중인데 버튼을 눌렀다면 정지
    if (isPlaying && !isJump) {
      shouldStop.current = true;
      playRunId.current++;
      ttsStop();
      setIsPlaying(false);
      setCurrentIdx(null);
      setIsWaiting(false);
      return;
    }
    if (sentences.length === 0) return;

    // 개별 재생 중이면 중단
    singleStop.current = true;
    ttsStop();
    setSingleIdx(null);
    setIsWaiting(false);
    await delay(50);

    shouldStop.current = false;
    const currentRun = ++playRunId.current;
    const isCancelled = () => playRunId.current !== currentRun || shouldStop.current;
    const localStopRef = { get current() { return isCancelled(); } };

    setIsPlaying(true);

    let playedInCycle = new Set();

    while (!isCancelled()) {
      let validIndices = onlyFavorites 
        ? (favoritesRef.current || [])
        : sentences.map((_, i) => i);

      if (validIndices.length === 0) break;

      let unplayed = validIndices.filter(idx => !playedInCycle.has(idx));
      
      if (unplayed.length === 0) {
        playedInCycle.clear();
        unplayed = [...validIndices];
      }

      let nextIdx;
      if (settingsRef.current.mode === 'random') {
        nextIdx = unplayed[Math.floor(Math.random() * unplayed.length)];
      } else {
        unplayed.sort((a, b) => a - b);
        nextIdx = unplayed[0];
      }

      if (isJump) {
        if (validIndices.includes(startFromIdx)) {
          nextIdx = startFromIdx;
        }
        isJump = false;
      }

      if (isCancelled()) break;
      setCurrentIdx(nextIdx);

      for (let r = 0; r < settingsRef.current.repeat; r++) {
        if (isCancelled()) break;
        setCurrentRepeat(r + 1);
        const rate = SPEED_MAP[settingsRef.current.speed];
        await speakSentence(sentences[nextIdx], rate, localStopRef, r);
        if (!isCancelled() && r < settingsRef.current.repeat - 1) await delay(300);
      }

      if (!isCancelled() && setStudiedIndices) {
        setStudiedIndices(prev => prev.includes(nextIdx) ? prev : [...prev, nextIdx]);
      }

      playedInCycle.add(nextIdx);

      // 다음 문장으로 넘어가기 전, 사용자가 방금 들은 문장을 따라 말해볼 수 있도록 문장 길이에 비례하는 인터벌 부여
      const practiceDelay = Math.max(1500, (sentences[nextIdx]?.en?.length || 20) * 80);
      if (!isCancelled()) {
        setIsWaiting(true);
        await delay(practiceDelay);
        setIsWaiting(false);
      }
    }

    if (!isCancelled()) {
      setIsPlaying(false);
      setCurrentIdx(null);
      setIsWaiting(false);
    }
  }, [isPlaying, sentences, mode, speakSentence, setStudiedIndices, favorites]);

  // ── 개별 재생 ──────────────────────────────────────
  const handlePlayOne = useCallback(async (idx) => {
    if (isPlaying) {
      handlePlayAll(idx);
      return;
    }

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
    await delay(50);
    singleStop.current = false;

    setSingleIdx(idx);

    for (let r = 0; r < settingsRef.current.repeat; r++) {
      if (singleStop.current) break;
      setCurrentRepeat(r + 1);
      const rate = SPEED_MAP[settingsRef.current.speed];
      await speakSentence(sentences[idx], rate, singleStop, r);
      if (!singleStop.current && r < settingsRef.current.repeat - 1) await delay(300);
    }

    if (!singleStop.current && setStudiedIndices) {
      setStudiedIndices(prev => prev.includes(idx) ? prev : [...prev, idx]);
    }

    setSingleIdx(null);
  }, [singleIdx, sentences, speakSentence, isPlaying, handlePlayAll, setStudiedIndices]);

  // ── 설정 변경 시 즉시 반영 ──────────────────────────
  useEffect(() => {
    const prev = prevSettingsRef.current;
    if (
      prev.speed !== speed ||
      prev.mode !== mode ||
      prev.repeat !== repeat ||
      prev.langOrder !== langOrder ||
      prev.voiceEn !== voiceEn ||
      prev.voiceKo !== voiceKo
    ) {
      prevSettingsRef.current = { speed, mode, repeat, langOrder, voiceEn, voiceKo };
      
      // 설정이 바뀌면 현재 읽고 있는 위치에서 즉시 재시작하여 새 설정 적용
      if (isPlaying && currentIdx !== null) {
        handlePlayAll(currentIdx);
      } else if (singleIdx !== null) {
        handlePlayOne(singleIdx);
      }
    }
  }, [speed, mode, repeat, langOrder, voiceEn, voiceKo, isPlaying, currentIdx, singleIdx, handlePlayAll, handlePlayOne]);

  const activeIdx = currentIdx !== null ? currentIdx : singleIdx;
  const activeSentence = activeIdx !== null ? sentences[activeIdx] : null;

  // ── 출퇴근 모드 컨트롤 ─────────────────────────────────
  const handleNext = useCallback(() => {
    if (!currentListRef.current) return;
    const { list, origIndices } = currentListRef.current;
    if (!list || list.length === 0) return;
    const currentListIdx = origIndices.indexOf(activeIdx);
    
    if (!isPlaying && singleIdx === null) {
       handlePlayAll(origIndices[0]);
       return;
    }

    if (currentListIdx !== -1 && currentListIdx < list.length - 1) {
      handlePlayAll(origIndices[currentListIdx + 1]);
    } else {
      shouldStop.current = true;
      playRunId.current++;
      ttsStop();
      setIsPlaying(false);
      setCurrentIdx(null);
    }
  }, [activeIdx, isPlaying, singleIdx, handlePlayAll, ttsStop]);

  const handlePrev = useCallback(() => {
    if (!currentListRef.current) return;
    const { list, origIndices } = currentListRef.current;
    if (!list || list.length === 0) return;
    const currentListIdx = origIndices.indexOf(activeIdx);
    
    if (currentListIdx > 0) {
      handlePlayAll(origIndices[currentListIdx - 1]);
    } else if (currentListIdx === 0) {
      handlePlayAll(origIndices[0]);
    }
  }, [activeIdx, handlePlayAll]);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      shouldStop.current = true;
      playRunId.current++;
      ttsStop();
      setIsPlaying(false);
      setCurrentIdx(null);
    } else {
      if (activeIdx !== null) {
        handlePlayAll(activeIdx);
      } else {
        handlePlayAll();
      }
    }
  }, [isPlaying, activeIdx, handlePlayAll, ttsStop]);

  return (
    <div className="tab-fade-in">
      <div
        className={`settings-container ${showSettings ? 'open' : ''}`}
        onFocus={() => setIsFocusedInSettings(true)}
        onBlur={() => setIsFocusedInSettings(false)}
      >
        <div className="settings-header" onClick={() => setShowSettings(!showSettings)}>
          <div className="settings-left">
            <div className="settings-ic"><i className="material-symbols-outlined" style={{ fontSize: '20px' }}>settings</i></div>
            <div className="settings-label">재생 설정</div>
          </div>
          <i className="material-symbols-outlined chev">expand_more</i>
        </div>
        <div className="settings-panel">
          <div className="settings-panel-inner">
          <div className="row">
            <span>언어</span>
            <select
              value={langOrder}
              onChange={e => setLangOrder(e.target.value)}
              className="settings-select"
            >
              <option value="en-ko">영어 ➔ 한국어</option>
              <option value="ko-en">한국어 ➔ 영어</option>
            </select>
          </div>
          <div className="row">
            <span>반복</span>
            <select
              value={repeat}
              onChange={e => setRepeat(Number(e.target.value))}
              className="settings-select"
            >
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}회</option>)}
            </select>
          </div>
          <div className="row">
            <span>속도</span>
            <select value={speed} onChange={e => setSpeed(e.target.value)} className="settings-select">
              <option value="slow">느림</option>
              <option value="normal">보통</option>
              <option value="slightly_fast">약간 빠름</option>
              <option value="fast">빠름</option>
            </select>
          </div>
          <div className="row">
            <span>모드</span>
            <select value={mode} onChange={e => setMode(e.target.value)} className="settings-select">
              <option value="sequential">순차</option>
              <option value="random">랜덤</option>
            </select>
          </div>
          <div className="row">
            <span>영어 (기기)</span>
            <select value={voiceEn} onChange={e => setVoiceEn(e.target.value)} className="settings-select">
              <option value="">(자동 선택)</option>
              {localVoices.en.map(v => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>
          {ttsApiKey && (
            <>
              <div className="row">
                <span>한국어 (AI)</span>
                <select value={voiceKo} onChange={e => setVoiceKo(e.target.value)} className="settings-select">
                  {GOOGLE_VOICES['ko-KR'].map(v => (
                    <option key={v.name} value={v.name}>{v.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        {isPlaying ? (
          <button className="cta" style={{ margin: 0, flex: 4 }} onClick={() => handlePlayAll()}>
            <i className="material-symbols-outlined" style={{ fontSize: '22px' }}>stop_circle</i>
            재생 중지
          </button>
        ) : (
          <>
            <button className="cta" style={{ margin: 0, flex: 2 }} onClick={() => handlePlayAll(null, false)} disabled={sentences.length === 0}>
              <i className="material-symbols-outlined" style={{ fontSize: '22px' }}>play_circle</i>
              전체
            </button>
            <button className="cta" style={{ margin: 0, flex: 2 }} onClick={() => handlePlayAll(null, true)} disabled={!favorites || favorites.length === 0}>
              <i className="material-symbols-outlined" style={{ fontSize: '22px' }}>star</i>
              선택
            </button>
          </>
        )}
        <button className="cta btn-orange" style={{ margin: 0, flex: 2 }} onClick={() => setIsCommuteMode(true)}>
          <i className="material-symbols-outlined" style={{ fontSize: '22px' }}>podcasts</i>
          팟캐스트
        </button>
      </div>

      {activeSentence && (
        <div className="now-playing">
          <div className="now-playing-header">
            {isWaiting ? (
              <>
                <i className="material-symbols-outlined" style={{ fontSize: '18px', color: '#FFFFFF', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>record_voice_over</i>
                <span style={{ color: '#FFFFFF', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>따라 말해보세요!</span>
              </>
            ) : (
              <>
                <i className="material-symbols-outlined" style={{ fontSize: '18px' }}>volume_up</i>
                현재 재생 중
                {ttsStatus === 'api' && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', background: 'var(--amber)', color: '#fff', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    <i className="material-symbols-outlined" style={{ fontSize: '12px' }}>cloud_download</i> API 호출
                  </span>
                )}
                {ttsStatus === 'cache' && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', background: 'var(--teal)', color: '#fff', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    <i className="material-symbols-outlined" style={{ fontSize: '12px' }}>bolt</i> 캐시 재생
                  </span>
                )}
                {ttsStatus === 'fallback' && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', background: 'var(--ink-soft)', color: '#fff', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    <i className="material-symbols-outlined" style={{ fontSize: '12px' }}>robot_2</i> 기본 음성
                  </span>
                )}
              </>
            )}
            {settingsRef.current.repeat > 1 && !isWaiting && (
              <span style={{ marginLeft: '6px', opacity: 0.9, fontSize: '12px', background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                {currentRepeat} / {settingsRef.current.repeat}회
              </span>
            )}
          </div>
          {langOrder === 'ko-en' ? (
            <>
              <div className="now-playing-en">{activeSentence.ko}</div>
              <div className="now-playing-ko">{activeSentence.en}</div>
            </>
          ) : (
            <>
              <div className="now-playing-en">{activeSentence.en}</div>
              <div className="now-playing-ko">{activeSentence.ko}</div>
            </>
          )}
        </div>
      )}

      <div className="list-header">
        <div className="list-title" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="n">재생 목록</span>
          <span className="c">{sentences.length}개 문장</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={(e) => { e.stopPropagation(); onSavePack?.(); }} style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '8px', border: 'none', background: 'var(--teal)', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <i className="material-symbols-outlined" style={{ fontSize: '16px', color: 'inherit' }}>save</i>
            보관함에 저장
          </button>
        </div>
      </div>

      {showList && (
        <div className="transcript">
          {sentences.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '14px', color: 'var(--ink-soft)' }}>
              생성 탭에서 문장을 만들어보세요.
            </div>
          ) : (
            sentences.map((s, idx) => {
              const isThis = currentIdx === idx || singleIdx === idx;
              const isCompleted = studiedIndices && studiedIndices.includes(idx);
              const isFavorite = favorites && favorites.includes(idx);
              
              const toggleFavorite = (e) => {
                e.stopPropagation();
                setFavorites(prev => 
                  prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                );
              };

              return (
                <div 
                  className="turn" 
                  key={idx} 
                  style={{ transition: 'background-color 0.2s', backgroundColor: isThis ? 'var(--teal-tint)' : '' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                    {isCompleted ? (
                      <i className="material-symbols-outlined" style={{ color: 'var(--teal)', fontSize: '24px' }}>check_circle</i>
                    ) : (
                      <div className="turn-index">{idx + 1}</div>
                    )}
                  </div>
                  <div className="turn-body" onClick={() => handlePlayOne(idx)} style={{ cursor: 'pointer' }}>
                    {langOrder === 'ko-en' ? (
                      <>
                        <div className="turn-en" style={{ color: isThis ? 'var(--teal-deep)' : 'inherit' }}>
                          {s.ko}
                        </div>
                        <div className="turn-ko-row">
                          <div className="turn-ko-bar"></div>
                          <div className="turn-ko">{s.en}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="turn-en" style={{ color: isThis ? 'var(--teal-deep)' : 'inherit' }}>
                          {s.en}
                        </div>
                        <div className="turn-ko-row">
                          <div className="turn-ko-bar"></div>
                          <div className="turn-ko">{s.ko}</div>
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', paddingLeft: '8px' }}>
                    <button onClick={toggleFavorite} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFavorite ? 'var(--teal)' : 'var(--amber)' }}>
                      <i className="material-symbols-outlined" style={{ fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0", fontSize: '22px' }}>star</i>
                    </button>
                    <button onClick={() => handlePlayOne(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isThis ? 'var(--teal)' : 'var(--amber)' }}>
                      <i className="material-symbols-outlined" style={{ fontSize: '22px' }}>play_circle</i>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {isCommuteMode && (
        <div className="commute-mode-overlay">
          <div className="commute-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, paddingRight: '20px' }}>
              <i className="material-symbols-outlined" style={{ fontSize: '20px', color: '#888' }}>light_mode</i>
              <input 
                type="range" 
                min="0.1" 
                max="1.0" 
                step="0.05" 
                value={commuteBrightness} 
                onChange={e => setCommuteBrightness(Number(e.target.value))} 
                style={{ flex: 1, accentColor: 'var(--teal)' }}
              />
            </div>
            <button className="commute-close-btn" onClick={() => {
              setIsCommuteMode(false);
              if (isPlaying) {
                handlePlayAll();
              } else if (singleIdx !== null) {
                handlePlayOne(singleIdx);
              }
            }}>
              <i className="material-symbols-outlined">close</i>
            </button>
          </div>
          <div className="commute-content" style={{ filter: `brightness(${commuteBrightness})` }}>
            {activeSentence ? (
              langOrder === 'ko-en' ? (
                <>
                  <div className="commute-text-en">{activeSentence.ko}</div>
                  <div className="commute-text-ko">{activeSentence.en}</div>
                </>
              ) : (
                <>
                  <div className="commute-text-en">{activeSentence.en}</div>
                  <div className="commute-text-ko">{activeSentence.ko}</div>
                </>
              )
            ) : (
              <div className="commute-text-ko" style={{ color: '#888' }}>재생 대기 중...</div>
            )}
          </div>
          <div className="commute-controls" style={{ filter: `brightness(${commuteBrightness})` }}>
            <button className="commute-btn" onClick={handlePrev}>
              <i className="material-symbols-outlined">skip_previous</i>
            </button>
            <button className="commute-btn" onClick={handleTogglePlay}>
              <i className="material-symbols-outlined">
                {isPlaying ? "pause_circle" : "play_circle"}
              </i>
            </button>
            <button className="commute-btn" onClick={handleNext}>
              <i className="material-symbols-outlined">skip_next</i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

