import { useState, useEffect, useRef } from 'react';
import { useTTS } from '../hooks/useTTS';

// ── 하위 호환 정규화: string 배열 → { question, modelAnswer } 배열 ──────────
function normalizeQuestions(questions) {
  return questions.map(q => {
    if (typeof q === 'string') return { question: q, modelAnswer: '' };
    if (q && typeof q.question === 'string') return { question: q.question, modelAnswer: q.modelAnswer || '' };
    return null;
  }).filter(Boolean);
}

function TopicQAPresenter({ questions, packTitle, onBack, ttsApiKey, onProgress }) {
  const normalized = normalizeQuestions(questions);
  const [shuffledQuestions] = useState(() => [...normalized].sort(() => Math.random() - 0.5));
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(1);

  // packTitle에서 난이도 감지: 초급 20초, 중급/고급 30초
  const answerSeconds = packTitle.includes('초급') ? 20 : 30;

  const { speak: ttsSpeak, stop: ttsStop } = useTTS(ttsApiKey);

  const [isStopped, setIsStopped] = useState(false);
  const isStoppedRef = useRef(false);

  useEffect(() => {
    setIsStopped(false);
    isStoppedRef.current = false;
    if (onProgress) {
      onProgress(shuffledQuestions, currentQIndex);
    }
  }, [currentQIndex, shuffledQuestions, onProgress]);

  const toggleStop = () => {
    const next = !isStoppedRef.current;
    isStoppedRef.current = next;
    setIsStopped(next);
    if (next) ttsStop();
  };

  const currentItem = shuffledQuestions[currentQIndex];

  // ── 질문 단계: 3번 읽기 완료 후 타이머 시작 ────────────────────────────────
  useEffect(() => {
    if (done) return;
    if (!currentItem) return;

    let isCancelled = false;
    let timer = null;

    const runQuestionPhase = async () => {
      setTimeLeft(0); // 질문을 읽는 동안에는 항상 스피커 아이콘('질문 읽는 중...')이 표시되도록 타이머 초기화

      // 1. 질문 3번 읽기
      for (let i = 0; i < 3; i++) {
        if (isCancelled) return;
        
        while (isStoppedRef.current && !isCancelled) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        if (isCancelled) return;

        try {
          await ttsSpeak(currentItem.question, 'en-US', 1.0);
        } catch (err) {
          console.warn("TTS Playback skipped or failed:", err);
        }

        // 재생 도중 정지(Pause)된 경우, 해당 횟수의 나래이션을 끝까지 듣지 못한 것이므로
        // 루프 카운트(i)를 1 감소시켜 재생 재개 시 현재 문장을 처음부터 다시 읽어주도록 합니다.
        if (isStoppedRef.current) {
          i--;
        }
        
        if (i < 2 && !isCancelled) {
          let waited = 0;
          while (waited < 800 && !isCancelled) {
             if (!isStoppedRef.current) {
                await new Promise(resolve => setTimeout(resolve, 100));
                waited += 100;
             } else {
                break; // 정지된 경우 잔여 딜레이를 무시하고 다음 사이클의 대기 상태로 즉시 진입
             }
          }
        }
      }
      if (isCancelled) return;

      while (isStoppedRef.current && !isCancelled) {
         await new Promise(resolve => setTimeout(resolve, 200));
      }

      // 2. 읽기 완료 후 타이머 시작
      setTimeLeft(answerSeconds);
      setTotalTime(answerSeconds);

      timer = setInterval(() => {
        if (isStoppedRef.current) return;
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            // React 상태 업데이트 함수(prev => ...) 내부에서 다른 상태를 변경하면 무시될 수 있으므로 setTimeout으로 분리
            setTimeout(() => {
              ttsStop();
              if (currentQIndex < shuffledQuestions.length - 1) {
                setCurrentQIndex(q => q + 1);
              } else {
                setDone(true);
              }
            }, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    runQuestionPhase();

    return () => {
      isCancelled = true;
      if (timer) clearInterval(timer);
      ttsStop();
    };
  }, [currentQIndex, done, ttsSpeak, ttsStop, currentItem, answerSeconds, shuffledQuestions.length]);



  // ── 이전/다음 및 스와이프 기능 ───────────────────────────────────────────
  const handleNext = () => {
    ttsStop();
    if (currentQIndex < shuffledQuestions.length - 1) {
      setCurrentQIndex(q => q + 1);
    } else {
      setDone(true);
    }
  };

  const handlePrev = () => {
    ttsStop();
    if (currentQIndex > 0) {
      setCurrentQIndex(q => q - 1);
    }
  };

  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const handlePointerDown = (e) => {
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
  };

  const handlePointerUp = (e) => {
    if (touchStartX.current === null) return;
    const diffX = touchStartX.current - e.clientX;
    const diffY = touchStartY.current - e.clientY;

    // 수평 이동(diffX)이 120px 이상이면서 수직 이동(diffY)보다 큰 경우에만 스와이프로 인정 (수직 스크롤 오작동 방지)
    if (Math.abs(diffX) > 120 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        handleNext(); // 왼쪽으로 스와이프/드래그 (다음)
      } else {
        handlePrev(); // 오른쪽으로 스와이프/드래그 (이전)
      }
    } else if (Math.abs(diffX) < 20 && Math.abs(diffY) < 20) {
      // 제자리 클릭(탭)인 경우 (모바일 터치 흔들림 보정)
      toggleStop();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const progress = Math.round((currentQIndex / shuffledQuestions.length) * 100);

  return (
    <div className="rp-chat-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="rp-chat-header">
        <button className="rp-back-btn" onClick={() => { ttsStop(); onBack(); }}>
          <i className="material-symbols-outlined">arrow_back</i>
        </button>
        <div className="rp-chat-header-icon">
          <i className="material-symbols-outlined">quiz</i>
        </div>
        <div className="rp-chat-header-info">
          <div className="rp-chat-header-hint" style={{ fontSize: '15px', fontWeight: '500', color: 'var(--ink)' }}>
            Q {Math.min(currentQIndex + 1, shuffledQuestions.length)} / {shuffledQuestions.length}
            {' · '}English free-talking
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="rp-qa-progress">
        <div className="rp-qa-progress-fill" style={{ width: `${done ? 100 : progress}%`, transition: 'width 0.3s ease' }} />
      </div>

      {/* Body */}
      <div className="rp-presenter-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        {done ? (
          <div className="rp-done-banner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <i className="material-symbols-outlined" style={{ fontSize: '64px', color: '#f97316' }}>celebration</i>
            <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--on-surface, #1e293b)' }}>연습 완료!</h2>
            <p style={{ color: 'var(--on-surface-variant, #64748b)', fontSize: '16px' }}>모든 질문에 대한 프리토킹 연습을 마쳤습니다.</p>
            <button className="btn-orange" onClick={onBack} style={{ padding: '12px 24px', borderRadius: '12px', marginTop: '10px', fontSize: '16px', fontWeight: '600' }}>
              돌아가기
            </button>
          </div>

        ) : (
          /* ── 질문 단계 ── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', gap: '32px' }}>
            <div 
              onPointerDown={(e) => handlePointerDown(e)}
              onPointerUp={(e) => handlePointerUp(e)}
              onPointerLeave={(e) => handlePointerUp(e)}
              onPointerCancel={(e) => handlePointerUp(e)}
              style={{
              touchAction: 'pan-y', // 기본 제스처 충돌 방지 및 수직 스크롤 허용
              userSelect: 'none',
              background: isStopped ? '#475569' : '#f97316',
              color: 'white',
              padding: '20px 24px',
              borderRadius: '24px',
              boxShadow: isStopped ? 'none' : '0 10px 25px -5px rgba(249, 115, 22, 0.4)',
              width: '100%',
              textAlign: 'center',
              fontSize: '22px',
              fontWeight: 'bold',
              lineHeight: '1.4',
              wordBreak: 'keep-all',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}>
              {currentItem?.question}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                {timeLeft === 0 ? (
                  /* TTS 읽는 중 */
                  <div style={{ width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="material-symbols-outlined" style={{ fontSize: '52px', color: '#f97316', animation: 'pulse 1.2s ease-in-out infinite' }}>volume_up</i>
                  </div>
                ) : (
                  /* 카운트다운 */
                  <>
                    <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="50" cy="50" r="40" stroke="#e2e8f0" strokeWidth="8" fill="none" />
                      <circle
                        cx="50" cy="50" r="40"
                        stroke="#f97316"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={2 * Math.PI * 40}
                        strokeDashoffset={2 * Math.PI * 40 - (timeLeft / totalTime) * 2 * Math.PI * 40}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 'bold', color: '#f97316' }}>
                      {timeLeft}
                    </div>
                  </>
                )}
              </div>
              <div style={{ color: 'var(--on-surface-variant, #64748b)', fontSize: '15px', fontWeight: '500' }}>
                {isStopped ? <span style={{ animation: 'pulse 1.2s ease-in-out infinite' }}>일시 정지됨</span> : (timeLeft === 0 ? '질문 읽는 중...' : '답변할 시간!')}
              </div>
            </div>
            

          </div>
        )}
      </div>
    </div>
  );
}

// ── Main RoleplayTab ────────────────────────────────────────────────────────
export default function RoleplayTab({ apiKey, ttsApiKey, sentences = [], roleplayQuestions = [], setRoleplayQuestions, packTitle = '', isActive, onProgress }) {
  const [activeView, setActiveView] = useState('home'); // 'home' | 'qa'

  const hasQuestions = roleplayQuestions.length > 0;
  const hasSentences = sentences.length > 0;

  const handleStartQA = () => {
    if (hasQuestions) {
      setActiveView('qa');
    }
  };

  // 탭 비활성화 시 QA 세션 종료 (cleanup에서 ttsStop 자동 호출)
  useEffect(() => {
    if (!isActive && activeView === 'qa') {
      setActiveView('home');
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chat views ─────────────────────────────────────────────────────────
  if (activeView === 'qa' && hasQuestions) {
    return (
      <TopicQAPresenter
        questions={roleplayQuestions}
        packTitle={packTitle}
        ttsApiKey={ttsApiKey}
        onBack={() => setActiveView('home')}
        onProgress={onProgress}
      />
    );
  }

  // ── Home screen ─────────────────────────────────────────────────────────
  return (
    <div className="rp-container">
      {/* Header */}
      <div className="rp-header">
        <div className="rp-header-icon">
          <i className="material-symbols-outlined">record_voice_over</i>
        </div>
        <div>
          <h2 className="rp-header-title">Free-talking</h2>
          <p className="rp-header-sub">Practice speaking English out loud</p>
        </div>
      </div>



      <div className="rp-topic-panel">
        {hasQuestions ? (
          <div className="rp-topic-card">
            <button
              className="rp-start-btn"
              onClick={handleStartQA}
            >
              <i className="material-symbols-outlined">play_arrow</i>
              프리토킹 시작
            </button>
          </div>
        ) : (
          <div className="rp-topic-card" style={{ textAlign: 'center', color: 'var(--on-surface-variant, #64748b)', padding: '40px 20px' }}>
            프리토킹 질문 데이터가 없습니다.
          </div>
        )}

          <div className="rp-how-it-works">
            <div className="rp-hiw-title">이렇게 연습해요</div>
            <div className="rp-hiw-steps">
              <div className="rp-hiw-step">
                <span className="rp-hiw-num">1</span>
                <span>질문이 세 번 읽힙니다</span>
              </div>
              <div className="rp-hiw-step">
                <span className="rp-hiw-num">2</span>
                <span>30초 동안 영어로 자유롭게 소리 내어 답하세요</span>
              </div>
              <div className="rp-hiw-step">
                <span className="rp-hiw-num">3</span>
                <span>시간이 초과되거나 스와이프하면 다음 질문으로 넘어갑니다</span>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
