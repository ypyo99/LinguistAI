import { useState, useEffect } from 'react';
import { useTTS } from '../hooks/useTTS';

// ── 하위 호환 정규화: string 배열 → { question, modelAnswer } 배열 ──────────
function normalizeQuestions(questions) {
  return questions.map(q => {
    if (typeof q === 'string') return { question: q, modelAnswer: '' };
    if (q && typeof q.question === 'string') return { question: q.question, modelAnswer: q.modelAnswer || '' };
    return null;
  }).filter(Boolean);
}

function TopicQAPresenter({ questions, packTitle, onBack, ttsApiKey }) {
  const normalized = normalizeQuestions(questions);
  const [shuffledQuestions] = useState(() => [...normalized].sort(() => Math.random() - 0.5));
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [phase, setPhase] = useState('question'); // 'question' | 'modelAnswer'
  const [done, setDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(1);

  const { speak: ttsSpeak, stop: ttsStop } = useTTS(ttsApiKey);

  const currentItem = shuffledQuestions[currentQIndex];

  // ── 질문 단계: 3번 읽기 + 30초 타이머 ────────────────────────────────────
  useEffect(() => {
    if (done || phase !== 'question') return;
    if (!currentItem) return;

    const delaySeconds = 30;
    setTimeLeft(delaySeconds);
    setTotalTime(delaySeconds);

    let isCancelled = false;
    const playAudioThreeTimes = async () => {
      for (let i = 0; i < 3; i++) {
        if (isCancelled) break;
        await ttsSpeak(currentItem.question, 'en-US', 1.0);
        if (i < 2 && !isCancelled) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
    };
    playAudioThreeTimes();

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setPhase('modelAnswer');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      isCancelled = true;
      clearInterval(timer);
      ttsStop();
    };
  }, [currentQIndex, phase, done, ttsSpeak, ttsStop, currentItem]);

  // ── 모범답안 단계: TTS 읽어주기 ────────────────────────────────────────────
  useEffect(() => {
    if (done || phase !== 'modelAnswer') return;
    if (!currentItem?.modelAnswer) return;

    let isCancelled = false;
    const playModelAnswer = async () => {
      await new Promise(resolve => setTimeout(resolve, 600));
      if (!isCancelled) {
        await ttsSpeak(currentItem.modelAnswer, 'en-US', 0.95);
      }
    };
    playModelAnswer();

    return () => {
      isCancelled = true;
      ttsStop();
    };
  }, [phase, currentQIndex, done, ttsSpeak, ttsStop, currentItem]);

  // ── 다음으로 진행 ──────────────────────────────────────────────────────────
  const handleNext = () => {
    ttsStop();
    if (currentQIndex < shuffledQuestions.length - 1) {
      setCurrentQIndex(q => q + 1);
      setPhase('question');
    } else {
      setDone(true);
    }
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
          <i className="material-symbols-outlined">{phase === 'modelAnswer' ? 'lightbulb' : 'quiz'}</i>
        </div>
        <div className="rp-chat-header-info">
          <div className="rp-chat-header-hint" style={{ fontSize: '15px', fontWeight: '500', color: 'var(--ink)' }}>
            Q {Math.min(currentQIndex + 1, shuffledQuestions.length)} / {shuffledQuestions.length}
            {' · '}{phase === 'modelAnswer' ? '모범답안' : 'English free-talking'}
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

        ) : phase === 'question' ? (
          /* ── 질문 단계 ── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', gap: '32px' }}>
            <div style={{
              background: '#f97316',
              color: 'white',
              padding: '20px 24px',
              borderRadius: '24px',
              boxShadow: '0 10px 25px -5px rgba(249, 115, 22, 0.4)',
              width: '100%',
              textAlign: 'center',
              fontSize: '22px',
              fontWeight: 'bold',
              lineHeight: '1.4',
              wordBreak: 'keep-all'
            }}>
              {currentItem?.question}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative', width: '100px', height: '100px' }}>
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
              </div>
              <div style={{ color: 'var(--on-surface-variant, #64748b)', fontSize: '15px', fontWeight: '500' }}>
                답변할 시간!
              </div>
            </div>
          </div>

        ) : (
          /* ── 모범답안 단계 ── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', gap: '20px' }}>
            {/* 질문 (작게) */}
            <div style={{
              background: 'var(--surface-variant, #f1f5f9)',
              color: 'var(--on-surface-variant, #64748b)',
              padding: '12px 18px',
              borderRadius: '16px',
              width: '100%',
              textAlign: 'center',
              fontSize: '15px',
              fontWeight: '500',
              lineHeight: '1.4',
            }}>
              {currentItem?.question}
            </div>

            {/* 모범답안 레이블 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: '600', fontSize: '14px' }}>
              <i className="material-symbols-outlined" style={{ fontSize: '20px' }}>lightbulb</i>
              모범답안
            </div>

            {/* 모범답안 본문 */}
            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '2px solid #86efac',
              color: '#166534',
              padding: '20px 24px',
              borderRadius: '24px',
              boxShadow: '0 8px 20px -4px rgba(34, 197, 94, 0.2)',
              width: '100%',
              textAlign: 'center',
              fontSize: '20px',
              fontWeight: '500',
              lineHeight: '1.6',
              wordBreak: 'keep-all',
            }}>
              {currentItem?.modelAnswer || '(모범답안 없음)'}
            </div>

            {/* 다음 질문 버튼 */}
            <button
              className="btn-orange"
              onClick={handleNext}
              style={{ padding: '14px 32px', borderRadius: '14px', fontSize: '16px', fontWeight: '600', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {currentQIndex < shuffledQuestions.length - 1 ? (
                <>다음 질문 <i className="material-symbols-outlined">arrow_forward</i></>
              ) : (
                <>완료 <i className="material-symbols-outlined">check_circle</i></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main RoleplayTab ────────────────────────────────────────────────────────
export default function RoleplayTab({ apiKey, ttsApiKey, sentences = [], roleplayQuestions = [], setRoleplayQuestions, packTitle = '' }) {
  const [activeView, setActiveView] = useState('home'); // 'home' | 'qa'

  const hasQuestions = roleplayQuestions.length > 0;
  const hasSentences = sentences.length > 0;

  const handleStartQA = () => {
    if (hasQuestions) {
      setActiveView('qa');
    }
  };

  // ── Chat views ─────────────────────────────────────────────────────────
  if (activeView === 'qa' && hasQuestions) {
    return (
      <TopicQAPresenter
        questions={roleplayQuestions}
        packTitle={packTitle}
        ttsApiKey={ttsApiKey}
        onBack={() => setActiveView('home')}
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
                <span>30초 후 모범답안이 표시되고 읽어줍니다</span>
              </div>
              <div className="rp-hiw-step">
                <span className="rp-hiw-num">4</span>
                <span>모범답안 확인 후 다음 질문으로 넘어가세요</span>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
