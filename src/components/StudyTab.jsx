import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { useTTS, GOOGLE_VOICES } from '../hooks/useTTS';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useWakeLock } from '../hooks/useWakeLock';

// ── 유틸 ────────────────────────────────────────────
const SPEED_MAP = { slow: 0.6, normal: 1.0, slightly_fast: 1.25, fast: 1.25 };

const getDynamicRate = (speedMode, repeatIdx, totalRepeats) => {
  if (speedMode !== 'speed_up') {
    return SPEED_MAP[speedMode] || 1.0;
  }
  if (totalRepeats <= 1) return 1.0;
  const minRate = 0.8;
  const maxRate = 1.2;
  return minRate + ((maxRate - minRate) / (totalRepeats - 1)) * repeatIdx;
};

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

function AutoWidthSelect({ value, onChange, children, className }) {
  const [displayText, setDisplayText] = useState('');
  const selectRef = useRef(null);

  useLayoutEffect(() => {
    if (selectRef.current && selectRef.current.selectedOptions.length > 0) {
      setDisplayText(selectRef.current.selectedOptions[0].text);
    }
  }, [value, children]);

  return (
    <div className="auto-select-wrapper" data-value={displayText}>
      <select ref={selectRef} value={value} onChange={onChange} className={className}>
        {children}
      </select>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────
export default function StudyTab({ sentences = [], apiKey, ttsApiKey = '', setStudiedIndices, studiedIndices, favorites, setFavorites, onSavePack, user, isCommuteMode, setIsCommuteMode, isActive, initialCommuteIndex = 0 }) {
  const [showSettings, setShowSettings] = usePersistentState('linguist-study-settings', false);
  const [showList, setShowList] = usePersistentState('linguist-study-list', true);
  const favoritesRef = useRef(favorites);
  useEffect(() => { favoritesRef.current = favorites; }, [favorites]);
  const studiedIndicesRef = useRef(studiedIndices);
  useEffect(() => { studiedIndicesRef.current = studiedIndices; }, [studiedIndices]);
  const [commuteBrightness, setCommuteBrightness] = usePersistentState('linguist-commute-brightness', 1.0);
  
  const [isLocked, setIsLocked] = useState(false);
  const [showLockHint, setShowLockHint] = useState(false);
  const lockPressTimer = useRef(null);

  const [speed, setSpeed]       = usePersistentState('linguist-study-speed', 'normal');
  const [mode, setMode]         = usePersistentState('linguist-study-mode', 'sequential');
  const [langOrder, setLangOrder] = usePersistentState('linguist-study-lang', 'en-ko');
  const [korWordOrder, setKorWordOrder] = usePersistentState('linguist-study-kor-order', '한국어순');
  const [repeat, setRepeat]     = usePersistentState('linguist-study-repeat', 1);
  const [voiceEn, setVoiceEn]   = usePersistentState('linguist-voice-en', 'en-US-Neural2-C');
  const [voiceKo, setVoiceKo]   = usePersistentState('linguist-voice-ko', 'ko-KR-Neural2-C');

  const [localVoices, setLocalVoices] = useState({ en: [], ko: [] });
  useEffect(() => {
    const updateVoices = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const result = await TextToSpeech.getSupportedVoices();
          const voices = result.voices || [];
          setLocalVoices({
            en: voices.filter(v => v.lang.startsWith('en-') || v.lang.startsWith('en_') || v.lang === 'en'),
            ko: voices.filter(v => v.lang.startsWith('ko-') || v.lang.startsWith('ko_') || v.lang === 'ko')
          });
        } catch (e) {
          console.error("Native TTS GetVoices Failed", e);
        }
      } else {
        if (!window.speechSynthesis) return;
        const voices = window.speechSynthesis.getVoices();
        setLocalVoices({
          en: voices.filter(v => v.lang.startsWith('en-') || v.lang.startsWith('en_') || v.lang === 'en'),
          ko: voices.filter(v => v.lang.startsWith('ko-') || v.lang.startsWith('ko_') || v.lang === 'ko')
        });
      }
    };
    
    if (Capacitor.isNativePlatform()) {
      updateVoices();
    } else {
      if (window.speechSynthesis) {
        updateVoices();
        window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
      }
    }
    return () => {
      if (!Capacitor.isNativePlatform() && window.speechSynthesis) {
        window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
      }
    };
  }, []);

  const settingsRef = useRef({ speed, mode, repeat, langOrder, korWordOrder, voiceEn, voiceKo });
  const prevSettingsRef = useRef({ speed, mode, repeat, langOrder, korWordOrder, voiceEn, voiceKo });
  useEffect(() => {
    settingsRef.current = { speed, mode, repeat, langOrder, korWordOrder, voiceEn, voiceKo };
  }, [speed, mode, repeat, langOrder, korWordOrder, voiceEn, voiceKo]);

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
  const isPlayingFavoritesRef         = useRef(false);     // 즐겨찾기 재생 여부 기억
  const [singleIdx, setSingleIdx]     = useState(null);    // 개별 재생 중 인덱스
  const [currentRepeat, setCurrentRepeat] = useState(0);   // 현재 반복 회차
  const [currentRate, setCurrentRate] = useState(1.0);     // 현재 재생 배속
  const [currentSpeakingLang, setCurrentSpeakingLang] = useState(null); // 'en' or 'ko'
  const [isWaiting, setIsWaiting]     = useState(false);   // 따라 말하기 인터벌 대기 중 여부
  const [activeKoWordIdx, setActiveKoWordIdx] = useState(-1);
  const [isPaused, setIsPaused] = useState(false);

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

  // 탭 비활성화 시 재생 즉시 중지
  useEffect(() => {
    if (!isActive) {
      shouldStop.current = true;
      singleStop.current = true;
      playRunId.current++;
      ttsStop();
      setIsPlaying(false);
      setCurrentIdx(null);
      setSingleIdx(null);
      setIsWaiting(false);
      setIsPaused(false);
      if (isCommuteMode) setIsCommuteMode(false);
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isPlaying && singleIdx === null) setCurrentSpeakingLang(null);
  }, [isPlaying, singleIdx]);

  useEffect(() => {
    if (currentSpeakingLang === 'ko' && (currentIdx !== null || singleIdx !== null)) {
      const sentence = sentences[currentIdx !== null ? currentIdx : singleIdx];
      const koText = sentence ? (settingsRef.current.korWordOrder === '영어순' && sentence.ko_en_order ? sentence.ko_en_order : sentence.ko) : '';
      if (koText) {
        const chunks = koText.split('/');
        const textLen = koText.replace(/\//g, '').length;
        
        if (chunks.length > 0 && textLen > 0) {
          const estDuration = (textLen * 130);
          
          setActiveKoWordIdx(0);
          
          let accumulatedTime = 0;
          const timeouts = [];
          
          for (let i = 0; i < chunks.length; i++) {
            const chunkLen = chunks[i].length;
            const chunkTime = (chunkLen / textLen) * estDuration;
            accumulatedTime += chunkTime;
            
            if (i < chunks.length - 1) {
              const timeout = setTimeout(() => {
                setActiveKoWordIdx(i + 1);
              }, accumulatedTime);
              timeouts.push(timeout);
            }
          }
          
          return () => {
            timeouts.forEach(clearTimeout);
            setActiveKoWordIdx(-1);
          };
        } else {
          setActiveKoWordIdx(-1);
        }
      }
    } else {
      setActiveKoWordIdx(-1);
    }
  }, [currentSpeakingLang, currentIdx, singleIdx, sentences]);

  // ── TTS 헬퍼 (useTTS 훅 위임) ────────────────────────
  const speakSentence = useCallback(async (sentence, rate, stopRef, repeatIndex = 0) => {
    const isRoleplay = sentence.type === 'roleplay';
    const koText = settingsRef.current.korWordOrder === '영어순' && sentence.ko_en_order && !isRoleplay ? sentence.ko_en_order : sentence.ko;
    
    let pairs = [];
    if (isRoleplay) {
      pairs = [{ text: sentence.en, lang: 'en-US', isRoleplayAns: false }];
      // 프리토킹 모드에서는 모델 답변을 읽지 않음
    } else {
      pairs = settingsRef.current.langOrder === 'en-ko'
        ? [{ text: sentence.en, lang: 'en-US' }, { text: koText, lang: 'ko-KR' }]
        : [{ text: koText, lang: 'ko-KR' }, { text: sentence.en, lang: 'en-US' }];
    }

    // 한국어 문장은 첫 번째 재생(repeatIndex === 0)에서만 재생하고 이후 반복에서는 제외
    if (repeatIndex > 0 && !isRoleplay) {
      pairs = pairs.filter(p => p.lang !== 'ko-KR');
    }

    for (const { text, lang, isRoleplayAns } of pairs) {
      if (stopRef.current) {
        setCurrentSpeakingLang(null);
        return;
      }
      const actualRate = lang === 'ko-KR' ? 1.0 : rate;
      if (isRoleplay) {
        setCurrentSpeakingLang(isRoleplayAns ? 'roleplay-ans' : 'roleplay-q');
      } else {
        setCurrentSpeakingLang(lang === 'ko-KR' ? 'ko' : 'en');
      }
      let textToSpeak = text;
      if (lang === 'ko-KR') {
        textToSpeak = settingsRef.current.korWordOrder === '영어순' 
          ? text.replace(/\//g, '... ') 
          : text.replace(/\//g, '');
      }
      await ttsSpeak(textToSpeak, lang, actualRate);
      if (stopRef.current) {
        setCurrentSpeakingLang(null);
        return;
      }
      await delay(350);
    }
    setCurrentSpeakingLang(null);
  }, [ttsSpeak]);


  // ── 전체 재생 ──────────────────────────────────────
  const handlePlayAll = useCallback(async (startFromIdx = null, onlyFavoritesArg = null) => {
    let isJump = typeof startFromIdx === 'number';

    // onlyFavorites 인자가 안 넘어온 경우(설정 변경 시 등), 기존 상태 유지
    let onlyFavorites = onlyFavoritesArg !== null ? onlyFavoritesArg : isPlayingFavoritesRef.current;
    
    // 새 재생(버튼 클릭)인 경우 상태 업데이트
    if (!isJump) {
      isPlayingFavoritesRef.current = onlyFavorites;
    }

    // 재생 중인데 버튼을 눌렀다면 정지
    if (isPlaying && !isJump) {
      shouldStop.current = true;
      playRunId.current++;
      ttsStop();
      setIsPlaying(false);
      setCurrentIdx(null);
      setIsWaiting(false);
      setIsPaused(false);
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

    setIsPaused(false);
    setIsPlaying(true);

    let validIndicesForInit = onlyFavorites 
      ? (favoritesRef.current || [])
      : sentences.map((_, i) => i);
      
    let playedInCycle = new Set();
    
    // 설정 변경 등으로 점프할 때 이전 인덱스들을 이미 재생한 것으로 처리
    if (isJump && validIndicesForInit.includes(startFromIdx)) {
      const startPos = validIndicesForInit.indexOf(startFromIdx);
      for (let i = 0; i < startPos; i++) {
        playedInCycle.add(validIndicesForInit[i]);
      }
    }

    while (!isCancelled()) {
      let validIndices = onlyFavorites 
        ? (favoritesRef.current || [])
        : sentences.map((_, i) => i);

      if (validIndices.length === 0) break;

      let unplayed = validIndices.filter(idx => !playedInCycle.has(idx));
      
      if (unplayed.length === 0) {
        break;
      }

      let nextIdx;
      if (settingsRef.current.mode === 'random') {
        const currentStudied = studiedIndicesRef.current || [];
        // 아직 한 번도 공부하지 않은 문장을 먼저 찾음
        const unstudiedUnplayed = unplayed.filter(idx => !currentStudied.includes(idx));
        
        if (unstudiedUnplayed.length > 0) {
          nextIdx = unstudiedUnplayed[Math.floor(Math.random() * unstudiedUnplayed.length)];
        } else {
          nextIdx = unplayed[Math.floor(Math.random() * unplayed.length)];
        }
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
        const rate = getDynamicRate(settingsRef.current.speed, r, settingsRef.current.repeat);
        setCurrentRate(rate);
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
  const handlePlayOne = useCallback(async (idx, isResume = false) => {
    if (isPlaying) {
      handlePlayAll(idx);
      return;
    }

    // 이미 재생 중인 항목 클릭 → 정지
    if (!isResume && singleIdx === idx && !isPaused) {
      singleStop.current = true;
      ttsStop();
      setSingleIdx(null);
      setIsPaused(false);
      return;
    }
    // 이전 재생 중단
    singleStop.current = true;
    ttsStop();
    await delay(50);
    singleStop.current = false;
    setIsPaused(false);

    setSingleIdx(idx);

    for (let r = 0; r < settingsRef.current.repeat; r++) {
      if (singleStop.current) break;
      setCurrentRepeat(r + 1);
      const rate = getDynamicRate(settingsRef.current.speed, r, settingsRef.current.repeat);
      setCurrentRate(rate);
      await speakSentence(sentences[idx], rate, singleStop, r);
      if (!singleStop.current && r < settingsRef.current.repeat - 1) await delay(300);
    }

    if (!singleStop.current) {
      if (setStudiedIndices) setStudiedIndices(prev => prev.includes(idx) ? prev : [...prev, idx]);
      setSingleIdx(null);
    }
  }, [singleIdx, sentences, speakSentence, isPlaying, isPaused, handlePlayAll, setStudiedIndices]);



  // ── 설정 변경 시 즉시 반영 ──────────────────────────
  useEffect(() => {
    const prev = prevSettingsRef.current;
    if (
      prev.speed !== speed ||
      prev.mode !== mode ||
      prev.repeat !== repeat ||
      prev.langOrder !== langOrder ||
      prev.korWordOrder !== korWordOrder ||
      prev.voiceEn !== voiceEn ||
      prev.voiceKo !== voiceKo
    ) {
      prevSettingsRef.current = { speed, mode, repeat, langOrder, korWordOrder, voiceEn, voiceKo };
      
      // 설정이 바뀌면 현재 읽고 있는 위치에서 즉시 재시작하여 새 설정 적용
      if (isPlaying && currentIdx !== null) {
        handlePlayAll(currentIdx);
      } else if (singleIdx !== null) {
        handlePlayOne(singleIdx);
      }
    }
  }, [speed, mode, repeat, langOrder, korWordOrder, voiceEn, voiceKo, isPlaying, currentIdx, singleIdx, handlePlayAll, handlePlayOne]);

  const activeIdx = currentIdx !== null ? currentIdx : singleIdx;
  const activeSentence = activeIdx !== null ? sentences[activeIdx] : null;

  // ── 집중모드 진입 시 자동 재생 시작 ────────────────────────────────────────
  // 다른 탭(예: 프리토킹)에서 Header의 집중모드 버튼으로 진입하면
  // StudyTab이 재생 중이 아닌 상태에서 isCommuteMode가 켜지므로 자동 재생해야 합니다.
  const prevIsCommuteModeRef = useRef(false);
  useEffect(() => {
    const justEnteredCommuteMode = isCommuteMode && !prevIsCommuteModeRef.current;
    prevIsCommuteModeRef.current = isCommuteMode;

    if (justEnteredCommuteMode && !isPlaying && singleIdx === null && sentences.length > 0) {
      // 짧은 딜레이를 두어 탭 전환 및 컴포넌트 마운트가 완료된 후 재생 시작
      const t = setTimeout(() => {
        handlePlayAll(initialCommuteIndex ?? null);
      }, 150);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCommuteMode]);

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

  const handleNextSentence = useCallback(() => {
    if (activeIdx === null || sentences.length === 0) return;
    let validIndices = isPlayingFavoritesRef.current && favoritesRef.current ? favoritesRef.current : sentences.map((_, i) => i);
    if (validIndices.length === 0) return;
    const currentListIdx = validIndices.indexOf(activeIdx);
    let nextListIdx = currentListIdx + 1;
    if (nextListIdx >= validIndices.length) nextListIdx = 0;
    const nextIdx = validIndices[nextListIdx];
    
    if (isPlaying) {
      handlePlayAll(nextIdx);
    } else {
      handlePlayOne(nextIdx);
    }
  }, [activeIdx, sentences, isPlaying, handlePlayAll, handlePlayOne]);

  const handlePrevSentence = useCallback(() => {
    if (activeIdx === null || sentences.length === 0) return;
    let validIndices = isPlayingFavoritesRef.current && favoritesRef.current ? favoritesRef.current : sentences.map((_, i) => i);
    if (validIndices.length === 0) return;
    const currentListIdx = validIndices.indexOf(activeIdx);
    let prevListIdx = currentListIdx - 1;
    if (prevListIdx < 0) prevListIdx = validIndices.length - 1;
    const prevIdx = validIndices[prevListIdx];
    
    if (isPlaying) {
      handlePlayAll(prevIdx);
    } else {
      handlePlayOne(prevIdx);
    }
  }, [activeIdx, sentences, isPlaying, handlePlayAll, handlePlayOne]);

  const handleTogglePlay = useCallback(() => {
    if (isPaused) {
      setIsPaused(false);
      if (activeIdx !== null) {
        if (singleIdx !== null) {
          handlePlayOne(singleIdx, true);
        } else {
          handlePlayAll(activeIdx);
        }
      } else {
        handlePlayAll();
      }
    } else {
      if (isPlaying || singleIdx !== null) {
        shouldStop.current = true;
        singleStop.current = true;
        playRunId.current++;
        ttsStop();
        setIsPlaying(false);
        setIsPaused(true);
        setIsWaiting(false);
      }
    }
  }, [isPlaying, isPaused, singleIdx, activeIdx, handlePlayAll, handlePlayOne, ttsStop]);

  const getStyleEn = () => {
    if (isWaiting || currentSpeakingLang === 'en') {
      return { fontWeight: 'bold', opacity: 1, color: '#FFFFFF', transition: 'all 0.3s' };
    }
    if (currentSpeakingLang === 'ko') {
      return { opacity: 0.6, transition: 'all 0.3s' };
    }
    return { transition: 'all 0.3s' }; // default
  };

  const getStyleKo = () => {
    if (currentSpeakingLang === 'ko') {
      return { fontWeight: 'bold', opacity: 1, color: '#FFFFFF', transition: 'all 0.3s' };
    }
    if (isWaiting || currentSpeakingLang === 'en') {
      return { opacity: 0.6, transition: 'all 0.3s' };
    }
    return { transition: 'all 0.3s' }; // default
  };

  const renderKoText = (text) => {
    if (currentSpeakingLang !== 'ko' || activeKoWordIdx === -1) {
      return text;
    }
    const chunks = text.split('/');
    
    return chunks.map((chunk, i) => {
      const isHighlighted = i === activeKoWordIdx;
      
      const leadingSpaceMatch = chunk.match(/^\s*/);
      const trailingSpaceMatch = chunk.match(/\s*$/);
      const leadingSpace = leadingSpaceMatch ? leadingSpaceMatch[0] : '';
      const trailingSpace = trailingSpaceMatch ? trailingSpaceMatch[0] : '';
      const trimmed = chunk.trim();

      return (
        <span key={i}>
          {leadingSpace}
          <span 
            style={isHighlighted ? { 
              backgroundColor: '#FFFFFF', 
              color: '#EA580C', 
              padding: '2px 4px', 
              margin: '0 0px',
              borderRadius: '4px',
              transition: 'background-color 0.1s, color 0.1s'
            } : {
              transition: 'background-color 0.3s, color 0.3s'
            }}
          >
            {trimmed}
          </span>
          {trailingSpace}
          {i < chunks.length - 1 && <span>/</span>}
        </span>
      );
    });
  };

  const isSwiping = useRef(false);
  const touchStartRef = useRef(null);
  const touchStartYRef = useRef(null);

  const handleTouchStart = (e) => {
    isSwiping.current = false;
    touchStartRef.current = e.targetTouches[0].clientX;
    touchStartYRef.current = e.targetTouches[0].clientY;
  };

  const handleTouchMove = (e) => {
    if (!touchStartRef.current) return;
    const diffX = touchStartRef.current - e.targetTouches[0].clientX;
    const diffY = touchStartYRef.current - e.targetTouches[0].clientY;
    if (Math.abs(diffX) > 20 && Math.abs(diffX) > Math.abs(diffY)) {
      isSwiping.current = true;
    }
  };

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return;
    const touchEndClientX = e.changedTouches[0].clientX;
    const touchEndClientY = e.changedTouches[0].clientY;
    const distanceX = touchStartRef.current - touchEndClientX;
    const distanceY = touchStartYRef.current - touchEndClientY;
    
    if (Math.abs(distanceX) > 120 && Math.abs(distanceX) > Math.abs(distanceY)) {
      if (distanceX > 0) {
        handleNextSentence();
      } else {
        handlePrevSentence();
      }
    }
    touchStartRef.current = null;
    touchStartYRef.current = null;
  };

  const onNowPlayingClick = (e) => {
    if (isSwiping.current) {
      isSwiping.current = false;
      return;
    }
    handleTogglePlay();
  };

  const getStyleCommuteEn = () => {
    if (isWaiting || currentSpeakingLang === 'en') {
      return { opacity: 1, color: '#FFFFFF', transition: 'all 0.3s' };
    }
    if (currentSpeakingLang === 'ko') {
      return { opacity: 0.5, transition: 'all 0.3s' };
    }
    return { transition: 'all 0.3s' };
  };

  const getStyleCommuteKo = () => {
    if (currentSpeakingLang === 'ko') {
      return { fontWeight: 'bold', opacity: 1, color: '#FFFFFF', transition: 'all 0.3s' };
    }
    if (isWaiting || currentSpeakingLang === 'en') {
      return { opacity: 0.5, transition: 'all 0.3s' };
    }
    return { transition: 'all 0.3s' };
  };

  const getStyleCommuteRoleplayQ = () => {
    if (currentSpeakingLang === 'roleplay-q') {
      return { opacity: 1, color: '#FFFFFF', transform: 'scale(1.02)' };
    }
    return { opacity: 0.6, color: '#a1a1aa' };
  };

  const getStyleCommuteRoleplayAns = () => {
    if (currentSpeakingLang === 'roleplay-ans') {
      return { opacity: 1, color: '#FFFFFF', transform: 'scale(1.02)' };
    }
    return { opacity: 0.6, color: '#a1a1aa' };
  };

  return (
    <div className="tab-fade-in">
      <div
        className={`settings-container ${showSettings ? 'open' : ''}`}
        onFocus={() => setIsFocusedInSettings(true)}
        onBlur={() => setIsFocusedInSettings(false)}
      >
        <div className="settings-header" onClick={() => setShowSettings(!showSettings)}>
          <div className="settings-left">
            <div className="settings-ic"><i className="material-symbols-outlined" style={{ fontSize: '20px' }}>tune</i></div>
            <div className="settings-label">재생 설정</div>
          </div>
          <i className="material-symbols-outlined chev">expand_more</i>
        </div>
        <div className="settings-panel">
          <div className="settings-panel-inner">
          <div className="row">
            <span>언어</span>
            <AutoWidthSelect
              value={langOrder}
              onChange={e => setLangOrder(e.target.value)}
              className="settings-select"
            >
              <option value="en-ko">영어 ➔ 한국어</option>
              <option value="ko-en">한국어 ➔ 영어</option>
            </AutoWidthSelect>
          </div>

          <div className="row">
            <span>반복</span>
            <AutoWidthSelect
              value={repeat}
              onChange={e => setRepeat(Number(e.target.value))}
              className="settings-select"
            >
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}회</option>)}
            </AutoWidthSelect>
          </div>
          <div className="row">
            <span>속도</span>
            <AutoWidthSelect 
              value={speed === 'slightly_fast' ? 'fast' : speed} 
              onChange={e => {
                const newSpeed = e.target.value;
                setSpeed(newSpeed);
                if (newSpeed === 'speed_up') {
                  setRepeat(3);
                }
              }} 
              className="settings-select"
            >
              <option value="slow">느림</option>
              <option value="normal">보통</option>
              <option value="fast">빠름</option>
              <option value="speed_up">점진적 가속</option>
            </AutoWidthSelect>
          </div>
          <div className="row">
            <span>모드</span>
            <AutoWidthSelect value={mode} onChange={e => setMode(e.target.value)} className="settings-select">
              <option value="sequential">순차</option>
              <option value="random">랜덤</option>
            </AutoWidthSelect>
          </div>
          <div className="row">
            <span>{ttsApiKey ? '영어 (AI)' : '영어'}</span>
            <AutoWidthSelect value={voiceEn} onChange={e => setVoiceEn(e.target.value)} className="settings-select">
              {ttsApiKey ? (
                GOOGLE_VOICES['en-US'].map(v => (
                  <option key={v.name} value={v.name}>{v.label}</option>
                ))
              ) : (
                <>
                  <option value="">(자동 선택)</option>
                  {localVoices.en.map(v => {
                    let cleanName = v.name
                      .replace(/영어|English|한국어|Korean|Desktop/gi, '')
                      .replace(/\(([^)]+)\)/g, ' $1 ') // 괄호 안 내용 유지, 괄호 제거
                      .replace(/United States/gi, 'US')
                      .replace(/United Kingdom/gi, 'UK')
                      .replace(/Republic of Korea/gi, 'KR')
                      .replace(/ - | -|- /g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim();
                    if (!cleanName) cleanName = v.name;
                    return <option key={v.name} value={v.name}>{cleanName}</option>;
                  })}
                </>
              )}
            </AutoWidthSelect>
          </div>
          <div className="row">
            <span>{ttsApiKey ? '한국어 (AI)' : '한국어'}</span>
            <AutoWidthSelect value={voiceKo} onChange={e => setVoiceKo(e.target.value)} className="settings-select">
              {ttsApiKey ? (
                // API 키가 있을 때는 고음질 구글 음성
                GOOGLE_VOICES['ko-KR'].map(v => (
                  <option key={v.name} value={v.name}>{v.label}</option>
                ))
              ) : (
                // API 키가 없을 때는 기기 내장 음성
                <>
                  <option value="">(자동 선택)</option>
                  {localVoices.ko.map(v => {
                    let cleanName = v.name
                      .replace(/영어|English|한국어|Korean|Desktop/gi, '')
                      .replace(/\(([^)]+)\)/g, ' $1 ') // 괄호 안 내용 유지, 괄호 제거
                      .replace(/United States/gi, 'US')
                      .replace(/United Kingdom/gi, 'UK')
                      .replace(/Republic of Korea/gi, 'KR')
                      .replace(/ - | -|- /g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim();
                    if (!cleanName) cleanName = v.name;
                    return <option key={v.name} value={v.name}>{cleanName}</option>;
                  })}
                </>
              )}
            </AutoWidthSelect>
          </div>
          <div className="row">
            <span>한국어 어순</span>
            <AutoWidthSelect
              value={korWordOrder}
              onChange={e => setKorWordOrder(e.target.value)}
              className="settings-select"
            >
              <option value="한국어순">한국어순</option>
              <option value="영어순">영어순</option>
            </AutoWidthSelect>
          </div>
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
          <i className="material-symbols-outlined" style={{ fontSize: '22px' }}>dark_mode</i>
          집중 모드
        </button>
      </div>

      {activeSentence && (
        <div 
          className="now-playing"
          onClick={onNowPlayingClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <div className="now-playing-header">
            {isPaused ? (
              <>
                <i className="material-symbols-outlined" style={{ fontSize: '18px' }}>pause_circle</i>
                <span style={{ animation: 'pulse 1.2s ease-in-out infinite' }}>일시 정지됨</span>
              </>
            ) : isWaiting ? (
              <>
                <i className="material-symbols-outlined" style={{ fontSize: '18px', color: '#FFFFFF', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>record_voice_over</i>
                <span style={{ color: '#FFFFFF', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>따라 말해보세요!</span>
              </>
            ) : (
              <>
                <i className="material-symbols-outlined" style={{ fontSize: '18px' }}>volume_up</i>
                현재 재생 중
              </>
            )}
            {settingsRef.current.repeat > 1 && !isWaiting && (
              <span style={{ marginLeft: '6px', opacity: 0.9, fontSize: '12px', background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                {currentRepeat} / {settingsRef.current.repeat}회
              </span>
            )}
            {!isWaiting && (
              <span style={{ marginLeft: '6px', opacity: 0.9, fontSize: '11px', fontWeight: 'bold', color: '#fff' }}>
                {currentRate.toFixed(1)}x
              </span>
            )}
          </div>

          {langOrder === 'ko-en' ? (
            <>
              <div className="now-playing-ko" style={getStyleKo()}>{renderKoText((korWordOrder === '영어순' && activeSentence.ko_en_order) ? activeSentence.ko_en_order : activeSentence.ko)}</div>
              <div className="now-playing-en" style={getStyleEn()}>{activeSentence.en}</div>
            </>
          ) : (
            <>
              <div className="now-playing-en" style={getStyleEn()}>{activeSentence.en}</div>
              <div className="now-playing-ko" style={getStyleKo()}>{renderKoText((korWordOrder === '영어순' && activeSentence.ko_en_order) ? activeSentence.ko_en_order : activeSentence.ko)}</div>
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
          {user?.accessToken && (
            <button onClick={(e) => { e.stopPropagation(); onSavePack?.(); }} style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '8px', border: 'none', background: 'var(--teal)', color: 'var(--save-btn-text)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <i className="material-symbols-outlined" style={{ fontSize: '16px', color: 'inherit' }}>save</i>
              내자료함에 저장
            </button>
          )}
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
                  <div 
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '2px', cursor: 'pointer' }}
                    onClick={() => handlePlayAll(idx)}
                  >
                    {isCompleted ? (
                      <i className="material-symbols-outlined" style={{ color: 'var(--teal)', fontSize: '24px' }}>check_circle</i>
                    ) : (
                      <div className="turn-index">{idx + 1}</div>
                    )}
                  </div>
                  <div className="turn-body" onClick={() => handlePlayAll(idx)} style={{ cursor: 'pointer' }}>
                    {langOrder === 'ko-en' ? (
                      <>
                        <div className="turn-en" style={{ color: isThis ? 'var(--teal-deep)' : 'inherit' }}>
                          {(korWordOrder === '영어순' && s.ko_en_order) ? s.ko_en_order : s.ko}
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
                          <div className="turn-ko">{(korWordOrder === '영어순' && s.ko_en_order) ? s.ko_en_order : s.ko}</div>
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', paddingLeft: '8px' }}>
                    <button onClick={toggleFavorite} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFavorite ? 'var(--teal)' : 'var(--amber)' }}>
                      <i className="material-symbols-outlined" style={{ fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0", fontSize: '22px' }}>star</i>
                    </button>
                    <button onClick={() => handlePlayAll(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isThis ? 'var(--teal)' : 'var(--amber)' }}>
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
            {!isLocked && (
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
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', marginLeft: isLocked ? 'auto' : '0' }}>
              <button 
                className="commute-close-btn" 
                style={{ 
                  marginRight: isLocked ? '0' : '12px', 
                  background: isLocked ? 'rgba(255, 255, 255, 0.15)' : '',
                  color: isLocked ? 'var(--amber)' : '',
                  position: 'relative',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none'
                }}
                onMouseDown={() => {
                  if (!isLocked) return;
                  lockPressTimer.current = setTimeout(() => {
                    setIsLocked(false);
                    setShowLockHint(false);
                    try { Haptics.impact({ style: ImpactStyle.Heavy }); } catch (e) {}
                  }, 800);
                }}
                onMouseUp={() => clearTimeout(lockPressTimer.current)}
                onMouseLeave={() => clearTimeout(lockPressTimer.current)}
                onTouchStart={() => {
                  if (!isLocked) return;
                  lockPressTimer.current = setTimeout(() => {
                    setIsLocked(false);
                    setShowLockHint(false);
                    try { Haptics.impact({ style: ImpactStyle.Heavy }); } catch (e) {}
                  }, 800);
                }}
                onTouchEnd={() => clearTimeout(lockPressTimer.current)}
                onClick={() => {
                  if (!isLocked) {
                    setIsLocked(true);
                    setShowLockHint(true);
                    setTimeout(() => setShowLockHint(false), 2500);
                  } else {
                    setShowLockHint(true);
                    setTimeout(() => setShowLockHint(false), 2500);
                  }
                }}
              >
                <i className="material-symbols-outlined">{isLocked ? 'lock' : 'lock_open'}</i>
                
                {/* 툴팁/힌트 */}
                {isLocked && showLockHint && (
                  <div style={{
                    position: 'absolute',
                    top: '120%',
                    right: 0,
                    background: 'rgba(0,0,0,0.8)',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    animation: 'fadeIn 0.2s',
                  }}>
                    길게 눌러 잠금 해제
                  </div>
                )}
              </button>

              {!isLocked && (
                <button 
                  className="commute-close-btn" 
                  onClick={() => setIsCommuteMode(false)}
                  style={{
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none'
                  }}
                >
                  <i className="material-symbols-outlined">close</i>
                </button>
              )}
            </div>
          </div>
          <div className="commute-content" style={{ filter: `brightness(${commuteBrightness})`, overflowY: 'auto' }}>
            {activeSentence ? (
              activeSentence.type === 'roleplay' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', width: '100%' }}>
                  <div className="commute-text-en" style={{ ...getStyleCommuteRoleplayQ(), fontSize: '26px', transition: 'all 0.3s' }}>
                    {activeSentence.en}
                  </div>
                  {/* 프리토킹 모드에서는 모델 답변 숨김 */}
                </div>
              ) : (
              langOrder === 'ko-en' ? (
                <>
                  <div className="commute-text-ko" style={getStyleCommuteKo()}>{(korWordOrder === '영어순' && activeSentence.ko_en_order) ? activeSentence.ko_en_order : activeSentence.ko}</div>
                  <div className="commute-text-en" style={getStyleCommuteEn()}>{activeSentence.en}</div>
                </>
              ) : (
                <>
                  <div className="commute-text-en" style={getStyleCommuteEn()}>{activeSentence.en}</div>
                  <div className="commute-text-ko" style={getStyleCommuteKo()}>{(korWordOrder === '영어순' && activeSentence.ko_en_order) ? activeSentence.ko_en_order : activeSentence.ko}</div>
                </>
              )
              )
            ) : (
              <div className="commute-text-ko" style={{ color: '#888' }}>재생 대기 중...</div>
            )}
          </div>
          
          {!isLocked && (
            <div className="commute-controls" style={{ filter: `brightness(${commuteBrightness})` }}>
              <button className="commute-btn" onClick={handlePrevSentence}>
                <i className="material-symbols-outlined">skip_previous</i>
              </button>
              <button className="commute-btn" onClick={handleTogglePlay}>
                <i className="material-symbols-outlined">
                  {(isPlaying || (singleIdx !== null && !isPaused)) ? "pause_circle" : "play_circle"}
                </i>
              </button>
              <button className="commute-btn" onClick={handleNextSentence}>
                <i className="material-symbols-outlined">skip_next</i>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

