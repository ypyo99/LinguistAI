import { useState, useRef, useEffect } from 'react';
import { useTTS, GOOGLE_VOICES } from '../hooks/useTTS';

function TopicQAPresenter({ questions, packTitle, onBack, ttsApiKey }) {
  const [shuffledQuestions] = useState(() => [...questions].sort(() => Math.random() - 0.5));
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(1);

  const { speak: ttsSpeak, stop: ttsStop } = useTTS(ttsApiKey);

  useEffect(() => {
    if (done) {
      ttsStop();
      return;
    }
    const currentQ = shuffledQuestions[currentQIndex];
    if (!currentQ) return;

    // 30 seconds for every question regardless of difficulty
    const delaySeconds = 30;
    setTimeLeft(delaySeconds);
    setTotalTime(delaySeconds);
    
    // Narrate the question
    ttsSpeak(currentQ, 'en-US', 1.0);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (currentQIndex < questions.length - 1) {
            setCurrentQIndex(q => q + 1);
          } else {
            setDone(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      ttsStop();
    };
  }, [currentQIndex, questions, done, ttsSpeak, ttsStop]);

  const progress = Math.round((currentQIndex / questions.length) * 100);

  return (
    <div className="rp-chat-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="rp-chat-header">
        <button className="rp-back-btn" onClick={onBack}>
          <i className="material-symbols-outlined">arrow_back</i>
        </button>
        <div className="rp-chat-header-icon">
          <i className="material-symbols-outlined">quiz</i>
        </div>
        <div className="rp-chat-header-info">
          <div className="rp-chat-header-hint" style={{ fontSize: '15px', fontWeight: '500', color: 'var(--ink)' }}>
            Q {Math.min(currentQIndex + 1, questions.length)} / {questions.length} · English free-talking
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', gap: '32px' }}>
            <div style={{
              background: '#f97316',
              color: 'white',
              padding: '40px',
              borderRadius: '24px',
              boxShadow: '0 10px 25px -5px rgba(249, 115, 22, 0.4)',
              width: '100%',
              textAlign: 'center',
              fontSize: '36px',
              fontWeight: 'bold',
              lineHeight: '1.4',
              wordBreak: 'keep-all'
            }}>
              {shuffledQuestions[currentQIndex]}
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
  if (activeView === 'qa' && (hasQuestions || roleplayQuestions.length > 0)) {
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
                <span>화면에 질문이 크게 표시됩니다</span>
              </div>
              <div className="rp-hiw-step">
                <span className="rp-hiw-num">2</span>
                <span>영어로 자유롭게 소리 내어 답하세요</span>
              </div>
              <div className="rp-hiw-step">
                <span className="rp-hiw-num">3</span>
                <span>30초가 지나면 다음 질문으로 자동으로 넘어갑니다</span>
              </div>
              <div className="rp-hiw-step">
                <span className="rp-hiw-num">4</span>
                <span>10개를 완료하면 세션이 종료됩니다</span>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
