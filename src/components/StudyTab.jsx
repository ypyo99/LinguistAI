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
export default function StudyTab({ sentences = [], apiKey, setStudiedIndices, studiedIndices }) {
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

  const speakSentence = useCallback(async (sentence, rate, stopRef, repeatIndex = 0) => {
    let pairs = langOrder === 'en-ko'
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

    for (let r = 0; r < repeat; r++) {
      if (singleStop.current) break;
      await speakSentence(sentences[idx], rate, singleStop, r);
      if (!singleStop.current && r < repeat - 1) await delay(300);
    }

    if (!singleStop.current && setStudiedIndices) {
      setStudiedIndices(prev => prev.includes(idx) ? prev : [...prev, idx]);
    }

    setSingleIdx(null);
  }, [singleIdx, speed, repeat, sentences, speakSentence]);

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
        await speakSentence(list[i], rate, shouldStop, r);
        if (!shouldStop.current && r < repeat - 1) await delay(300);
      }

      if (!shouldStop.current && setStudiedIndices) {
        setStudiedIndices(prev => prev.includes(origIndices[i]) ? prev : [...prev, origIndices[i]]);
      }

      if (!shouldStop.current && i < list.length - 1) await delay(600);
    }

    setIsPlaying(false);
    setCurrentIdx(null);
    shouldStop.current = false;
  }, [isPlaying, sentences, speed, mode, repeat, speakSentence]);

  const activeIdx = currentIdx !== null ? currentIdx : singleIdx;
  const activeSentence = activeIdx !== null ? sentences[activeIdx] : null;

  return (
    <div className="tab-fade-in">
      <div className={`settings-container ${showSettings ? 'open' : ''}`}>
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
            <span>반복 횟수</span>
            <select
              value={repeat}
              onChange={e => setRepeat(Number(e.target.value))}
              className="bg-transparent border-none text-right outline-none text-ink-soft"
            >
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}회</option>)}
            </select>
          </div>
          <div className="row">
            <span>재생 속도</span>
            <select
              value={speed}
              onChange={e => setSpeed(e.target.value)}
              className="bg-transparent border-none text-right outline-none text-ink-soft"
            >
              <option value="slow">느림</option>
              <option value="normal">보통</option>
              <option value="fast">빠름</option>
            </select>
          </div>
          <div className="row">
            <span>재생 모드</span>
            <select
              value={mode}
              onChange={e => setMode(e.target.value)}
              className="bg-transparent border-none text-right outline-none text-ink-soft"
            >
              <option value="sequential">순차</option>
              <option value="random">랜덤</option>
            </select>
          </div>
          </div>
        </div>
      </div>

      <button className="cta" onClick={handlePlayAll} disabled={sentences.length === 0}>
        <i className="material-symbols-outlined" style={{ fontSize: '22px' }}>{isPlaying ? "stop_circle" : "play_circle"}</i>
        {isPlaying ? '재생 중지' : '전체 재생'}
      </button>

      {activeSentence && (
        <div className="now-playing">
          <div className="now-playing-header">
            <i className="material-symbols-outlined" style={{ fontSize: '18px' }}>volume_up</i>
            현재 재생 중
          </div>
          <div className="now-playing-en">{activeSentence.en}</div>
          <div className="now-playing-ko">{activeSentence.ko}</div>
        </div>
      )}

      <div className="list-header" onClick={() => setShowList(!showList)} style={{ cursor: 'pointer' }}>
        <div className="list-title">
          <span className="n">재생 목록</span>
          <span className="c">{sentences.length}개 문장</span>
        </div>
        <i className="material-symbols-outlined">{showList ? 'expand_less' : 'expand_more'}</i>
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
              const isThisSingle = singleIdx === idx;
              return (
                <div 
                  className="turn" 
                  key={idx} 
                  onClick={() => handlePlayOne(idx)}
                  style={{ cursor: 'pointer', transition: 'background-color 0.2s', backgroundColor: isThis ? 'var(--teal-tint)' : 'transparent' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                    <div 
                      className="turn-index" 
                      style={
                        studiedIndices && studiedIndices.includes(idx)
                          ? { background: 'var(--teal)', color: '#fff' }
                          : { marginTop: 0 }
                      }
                    >
                      {idx + 1}
                    </div>
                  </div>
                  <div className="turn-body">
                    <div className="turn-en" style={{ color: isThis ? 'var(--teal-deep)' : 'inherit' }}>
                      {s.en}
                    </div>
                    <div className="turn-ko-row">
                      <div className="turn-ko-bar"></div>
                      <div className="turn-ko">{s.ko}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
