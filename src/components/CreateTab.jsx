import { useState, useEffect } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';

const DIFFICULTY_MAP = { '초급': 'beginner (A1-A2)', '중급': 'intermediate (B1-B2)', '고급': 'advanced (C1-C2)' };

export default function CreateTab({ apiKey, onGenerate }) {
  const [topic, setTopic] = usePersistentState('linguist-create-topic', '');
  const [difficulty, setDifficulty] = usePersistentState('linguist-create-difficulty', '초급');
  const [availableModels, setAvailableModels] = useState([]);

  useEffect(() => {
    if (!apiKey) return;
    const fetchModels = async () => {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.models) {
            const validModels = data.models
              .filter(m => {
                if (!m.supportedGenerationMethods || !m.supportedGenerationMethods.includes('generateContent')) return false;
                const name = m.name.replace('models/', '');
                
                // 1. gemini 계열 중 핵심 텍스트 모델(flash, pro)만 허용 (이미지/기타 특수 목적 제외)
                if (!name.startsWith('gemini-')) return false;
                if (!name.includes('flash') && !name.includes('pro')) return false;
                // 2. 구형 1.0 모델 제외 (JSON MimeType 옵션 미지원으로 에러 발생)
                if (name.includes('1.0')) return false;
                // 3. 구형 vision 전용 모델 제외
                if (name.includes('vision')) return false;
                // 4. 스냅샷(-001 등) 및 최신(-latest) 중복 별칭 제외 (대표 이름만 깔끔하게 유지)
                if (/-\d{3}$/.test(name) || name.endsWith('-latest')) return false;
                
                return true;
              })
              .map(m => m.name.replace('models/', ''));
            setAvailableModels(validModels);
          }
        }
      } catch (e) {
        console.error("Failed to fetch models", e);
      }
    };
    fetchModels();
  }, [apiKey]);

  const [count, setCount] = usePersistentState('linguist-create-count', 10);
  const [model, setModel] = usePersistentState('linguist-create-model', 'gemini-3.1-flash');
  const [customModel, setCustomModel] = usePersistentState('linguist-create-custom-model', '');
  const [inputMode, setInputMode] = usePersistentState('linguist-create-input-mode', 'api');
  const [manualText, setManualText] = useState('');

  // API 키가 없으면 자동으로 직접 붙여넣기 모드로 전환
  useEffect(() => {
    if (!apiKey && inputMode === 'api') {
      setInputMode('manual');
    }
  }, [apiKey, inputMode, setInputMode]);

  const isCustom = availableModels.length > 0 
    ? !availableModels.includes(model)
    : !['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro'].includes(model);

  
  
  const [loading, setLoading] = useState(false);
  const [generatingCount, setGeneratingCount] = useState(0);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = usePersistentState('linguist-create-preview', []);
  const [previewQuestions, setPreviewQuestions] = usePersistentState('linguist-create-preview-questions', []);
  const [packTitle, setPackTitle] = usePersistentState('linguist-create-packtitle', '');

  const getDifficultyRule = (diff) => {
    switch (diff) {
      case '초급': return '- STRICT RULE: Use very simple vocabulary, short sentences, and basic grammar (A1-A2 level).';
      case '중급': return '- STRICT RULE: Use everyday conversational vocabulary, moderate sentence length, and common idioms (B1-B2 level).';
      case '고급': return '- STRICT RULE: Use sophisticated vocabulary, complex grammar structures, and advanced/native idiomatic expressions (C1-C2 level).';
      default: return '';
    }
  };

  const generatedPrompt = `Generate exactly ${count} English learning sentences for a Korean learner.
Topic: "${topic || '일상 회화'}"
Level: ${DIFFICULTY_MAP[difficulty]}
Rules:
- Each sentence must be natural, practical, and appropriate for the context.
${getDifficultyRule(difficulty)}
- Korean translation must be accurate and natural.
- Extract 2-3 key words from the English sentence and provide their contextual Korean meaning in a "vocab" object.
- Return ONLY a valid JSON array, no markdown fences, no explanation.
Format: [{"en":"English sentence here","ko":"Korean translation here","vocab":{"word1":"meaning1", "word2":"meaning2"}}]`;

  const manualPrompt = `Generate exactly ${count} English learning sentences for a Korean learner.
Topic: "${topic || '일상 회화'}"
Level: ${DIFFICULTY_MAP[difficulty]}
Rules for sentences:
- Each sentence must be natural, practical, and appropriate for the context.
${getDifficultyRule(difficulty)}
- Korean translation must be accurate and natural.
- Extract 2-3 key words from the English sentence and provide their contextual Korean meaning in a "vocab" object.

Also generate exactly 10 open-ended English roleplay questions that:
- Are directly related to the topic above
- Encourage free-talking answers (not yes/no)
- Progress from simpler to more complex
- Sound natural and conversational

Return ONLY a valid JSON object containing both "sentences" and "roleplayQuestions". No markdown fences, no explanation.
Format:
{
  "sentences": [
    {"en":"English sentence here","ko":"Korean translation here","vocab":{"word1":"meaning1", "word2":"meaning2"}}
  ],
  "roleplayQuestions": [
    "Question 1?",
    "Question 2?"
  ]
}`;

  // ── 롤플레이 질문 생성 함수 ──────────────────────────────────
  const generateRoleplayQuestions = async (parsedSentences) => {
    const exampleSentences = parsedSentences.slice(0, 5).map(s => s.en).join('\n');
    const qPrompt = `You are an English teacher creating conversational practice questions for a Korean learner.
The learner is studying the topic: "${topic || '일상 회화'}" at ${DIFFICULTY_MAP[difficulty]} level.
Here are some of their learning sentences for context:
${exampleSentences}

Generate exactly 10 open-ended English questions that:
- Are directly related to the topic above
- Encourage free-talking answers (not yes/no)
- Progress from simpler to more complex
- Are appropriate for ${DIFFICULTY_MAP[difficulty]} level learners
- Sound natural and conversational

Return ONLY a valid JSON array of 10 question strings, no markdown, no explanation.
Format: ["Question 1?", "Question 2?", ...]`;

    try {
      const modelToUse = model.trim() || 'gemini-3.1-flash';
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: qPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024, responseMimeType: 'application/json' },
          }),
        }
      );
      if (!res.ok) return [];
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.every(q => typeof q === 'string')) return parsed;
      return [];
    } catch (e) {
      console.warn('롤플레이 질문 생성 실패:', e.message);
      return [];
    }
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setError('⚠️ 설정 탭에서 Gemini API 키를 먼저 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');
    setPreview([]);
    setPreviewQuestions([]);

    const prompt = generatedPrompt;

    try {
      let res;
      let errData;
      let fullText = '';
      let attempt = 0;
      const maxAttempts = 3;
      
      while (attempt < maxAttempts) {
        attempt++;
        setGeneratingCount(0);
        fullText = '';
        
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model.trim()}:streamGenerateContent?alt=sse&key=${apiKey.trim()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { 
                temperature: 0.8, 
                maxOutputTokens: 8192,
                responseMimeType: "application/json"
              },
            }),
          }
        );
        
        if (res.ok) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 마지막 불완전한 라인은 버퍼에 남김
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                if (dataStr.trim() === '') continue;
                try {
                  const dataObj = JSON.parse(dataStr);
                  const textPart = dataObj.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (textPart) {
                    fullText += textPart;
                    const matchCount = (fullText.match(/"en"/g) || []).length;
                    setGeneratingCount(Math.min(matchCount, count));
                  }
                } catch (e) {
                  // 청크 분할로 인한 JSON 파싱 에러 방어
                }
              }
            }
          }
          break;
        }
        
        errData = await res.json().catch(() => ({}));
        
        // 429(Too Many Requests)나 500번대(서버 에러/High Demand)인 경우 재시도
        if (res.status === 429 || res.status >= 500) {
          if (attempt < maxAttempts) {
            console.warn(`[Retry] 서버 혼잡 (${res.status}), 2초 후 재시도 (${attempt}/${maxAttempts})...`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
        }
        
        // 재시도 횟수를 초과했거나 다른 에러인 경우 던짐
        throw new Error((errData && errData.error && errData.error.message) || `HTTP ${res.status}`);
      }

      // JSON 추출 (마크다운 코드블록 제거 포함)
      const jsonMatch = fullText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error("AI Response FullText:", fullText);
        throw new Error(`응답에서 JSON 형식을 찾을 수 없습니다.\nAI 응답 내용: ${fullText.slice(0, 100)}...`);
      }

      let parsed = [];
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.warn("Standard JSON parse failed:", e.message, "Attempting recovery...");
        
        // 1. 에러 위치(position) 이전까지만 잘라서 다시 시도 (뒤에 쓰레기값이 붙은 경우)
        const posMatch = e.message.match(/position (\d+)/);
        if (posMatch) {
          const pos = parseInt(posMatch[1], 10);
          try {
            parsed = JSON.parse(jsonMatch[0].substring(0, pos).trim());
          } catch (e2) {
            console.warn("Recovery by substring failed.");
          }
        }
        
        // 2. 그래도 안되면 텍스트 전체에서 개별 문장 객체({ "en":..., "ko":... })만 무식하게 추출
        if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
          const matches = fullText.match(/\{[\s\S]*?\}/g) || [];
          for (const m of matches) {
            try {
              const obj = JSON.parse(m);
              if (obj && obj.en && obj.ko) parsed.push(obj);
            } catch(err) {}
          }
        }
        
        if (parsed.length === 0) {
          throw new Error(`JSON 복구 실패: ${e.message}\n응답 앞부분: ${fullText.slice(0, 100)}`);
        }
      }

      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('유효한 문장 데이터를 받지 못했습니다.');

      setPreview(parsed);

      // ── 롤플레이 질문 생성 (백그라운드) ──
      setGeneratingQuestions(true);
      const questions = await generateRoleplayQuestions(parsed);
      setPreviewQuestions(questions);
      setGeneratingQuestions(false);
    } catch (e) {
      setError(`오류: ${e.message}`);
      setGeneratingQuestions(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!manualText.trim()) return;
    
    try {
      // First try to parse as an object { sentences: [], roleplayQuestions: [] } (New manual prompt format)
      const objMatch = manualText.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try {
          const parsedObj = JSON.parse(objMatch[0]);
          if (parsedObj.sentences && Array.isArray(parsedObj.sentences) && parsedObj.sentences.length > 0 && parsedObj.sentences[0].en) {
            setPreview(parsedObj.sentences);
            if (parsedObj.roleplayQuestions && Array.isArray(parsedObj.roleplayQuestions)) {
              setPreviewQuestions(parsedObj.roleplayQuestions);
            }
            setError('');
            return;
          }
        } catch (e) {}
      }

      // Fallback: Try to parse as an array of sentences (Old prompt format / API fallback)
      const arrMatch = manualText.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        try {
          const parsedArr = JSON.parse(arrMatch[0]);
          if (Array.isArray(parsedArr) && parsedArr.length > 0 && parsedArr[0].en && parsedArr[0].ko) {
            setPreview(parsedArr);
            setError('');
            return;
          }
        } catch (e) {}
      }
    } catch (e) {
      // 입력 중이거나 유효하지 않은 JSON일 때는 무시
    }
  }, [manualText]);

  const handleApply = () => {
    if (preview.length > 0) {
      const baseTitle = packTitle.trim() || topic.trim() || '일상 회화';
      const generatedTitle = `${baseTitle}-${difficulty}-${preview.length}`;
      onGenerate(preview, generatedTitle, previewQuestions);
      setPreview([]); // 적용 후 미리보기 박스 숨기기
      setPreviewQuestions([]);
      setManualText(''); // 적용 후 텍스트 박스 초기화
    }
  };

  return (
    <div className="tab-fade-in">
      <div className="max-w-2xl mx-auto flex flex-col gap-4 sm:gap-lg">
        <section 
          className="rounded-xl shadow-sm border border-outline-variant dark:border-outline p-4 sm:p-lg transition-colors duration-200"
          style={{ background: 'var(--surface)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-md gap-3">
            <h2 className="text-base sm:text-title-md font-semibold text-on-surface dark:text-on-dark-surface">
              학습 문장 만들기
            </h2>
            <div className="flex bg-surface-variant/30 dark:bg-dark-surface-bright/30 p-1 rounded-lg shrink-0">
              <button
                onClick={() => setInputMode('api')}
                disabled={!apiKey}
                title={!apiKey ? "설정 탭에서 Gemini API 키를 먼저 입력해주세요." : ""}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  inputMode === 'api' 
                    ? 'bg-orange-500 dark:bg-orange-600 shadow-sm text-white' 
                    : !apiKey 
                      ? 'text-on-surface-variant/50 cursor-not-allowed opacity-50'
                      : 'text-on-surface-variant dark:text-on-dark-surface-variant hover:text-on-surface'
                }`}
              >
                API 자동 생성
              </button>
              <button
                onClick={() => setInputMode('manual')}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${inputMode === 'manual' ? 'bg-orange-500 dark:bg-orange-600 shadow-sm text-white' : 'text-on-surface-variant dark:text-on-dark-surface-variant hover:text-on-surface'}`}
              >
                직접 붙여넣기
              </button>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-md">
            {/* 제목 */}
            <div className="flex flex-col gap-1 sm:gap-base">
              <label className="text-xs sm:text-label-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant" htmlFor="packTitle">
                제목 <span className="opacity-60">(비워두면 프롬프트 기반 자동 생성)</span>
              </label>
              <input
                className="w-full h-10 sm:h-11 px-3 sm:px-md rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring placeholder:text-outline-variant dark:placeholder:text-on-dark-surface-variant transition-colors duration-200 text-sm sm:text-base"
                id="packTitle"
                placeholder="예: 비즈니스 미팅, 식당 예약..."
                type="text"
                value={packTitle}
                onChange={e => setPackTitle(e.target.value)}
              />
            </div>

            {/* 프롬프트 */}
            <div className="flex flex-col gap-1 sm:gap-base">
              <label className="text-xs sm:text-label-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant" htmlFor="topic">
                프롬프트 <span className="opacity-60">(비워두면 일상 회화)</span>
              </label>
              <input
                className="w-full h-10 sm:h-11 px-3 sm:px-md rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring placeholder:text-outline-variant dark:placeholder:text-on-dark-surface-variant transition-colors duration-200 text-sm sm:text-base"
                id="topic"
                placeholder="예: 비즈니스 미팅, 여행, 음식 주문..."
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              />
            </div>

            {/* 난이도 + 문장 개수 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-md">
              <div className="flex flex-col gap-1 sm:gap-base">
                <label className="text-xs sm:text-label-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant" htmlFor="difficulty">
                  난이도
                </label>
                <select
                  className="w-full h-10 sm:h-11 px-3 sm:px-md rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring transition-colors duration-200 text-sm sm:text-base"
                  id="difficulty"
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value)}
                >
                  <option>초급</option>
                  <option>중급</option>
                  <option>고급</option>
                </select>
              </div>
              <div className="flex flex-col gap-1 sm:gap-base">
                <label className="text-xs sm:text-label-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant" htmlFor="count">
                  문장 개수
                </label>
                <select
                  className="w-full h-10 sm:h-11 px-3 sm:px-md rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring transition-colors duration-200 text-sm sm:text-base"
                  id="count"
                  value={count}
                  onChange={e => setCount(Number(e.target.value))}
                >
                  {[10, 20, 30, 40, 50].map(n => <option key={n} value={n}>{n}개</option>)}
                </select>
              </div>
            </div>

            {inputMode === 'api' ? (
              <>
                {/* AI 모델 */}
                <div className="flex flex-col gap-1 sm:gap-base">
                  <label className="text-xs sm:text-label-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant" htmlFor="model">
                    AI 모델 (에러시 변경)
                  </label>
                  <div className="flex gap-2">
                    <select
                      className={`${isCustom ? 'w-2/5' : 'w-full'} h-10 sm:h-11 px-3 sm:px-md rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring transition-colors duration-200 text-sm sm:text-base font-mono`}
                      id="model"
                      value={isCustom ? 'custom' : model}
                      onChange={e => {
                        if (e.target.value === 'custom') {
                          setModel(customModel || 'gemini-1.5-flash-8b');
                        } else {
                          setModel(e.target.value);
                        }
                      }}
                    >
                      {availableModels.length > 0 ? (
                        <>
                          {availableModels.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                          <option value="custom">직접 입력...</option>
                        </>
                      ) : (
                        <>
                          <option value="gemini-1.5-flash">Gemini 1.5 Flash (표준)</option>
                          <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash-8B (가장 저렴)</option>
                          <option value="gemini-1.5-pro">Gemini 1.5 Pro (고성능)</option>
                          <option value="custom">직접 입력...</option>
                        </>
                      )}
                    </select>
                    
                    {isCustom && (
                      <input
                        type="text"
                        className="flex-1 h-10 sm:h-11 px-3 sm:px-md rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring transition-colors duration-200 text-sm sm:text-base font-mono"
                        placeholder="예: gemini-1.5-pro"
                        value={model}
                        onChange={e => {
                          setModel(e.target.value);
                          setCustomModel(e.target.value);
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* 에러 메시지 */}
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-error-container text-on-error-container text-xs sm:text-sm">
                    <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
                    {error}
                  </div>
                )}

                {/* 생성 버튼 */}
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="btn-orange w-full h-11 rounded-xl text-sm sm:text-label-md font-medium active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Gemini가 생성 중... ({generatingCount}/{count})
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl">auto_awesome</span>
                      문장 생성하기
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                {/* 직접 붙여넣기 모드 */}
                <div className="flex flex-col gap-3 sm:gap-md">
                  <div className="p-3 sm:p-4 rounded-lg bg-surface-variant/30 dark:bg-dark-surface-bright/30 border border-outline-variant/50 text-sm">
                    <p className="mb-2 font-medium text-on-surface dark:text-on-dark-surface text-xs sm:text-label-sm">1. 아래 프롬프트를 복사하여 ChatGPT나 Gemini에 물어보세요.</p>
                    <div className="relative">
                      <textarea
                        readOnly
                        value={manualPrompt}
                        className="w-full h-24 p-3 rounded-md bg-surface-container-lowest dark:bg-dark-bg text-on-surface-variant dark:text-on-dark-surface-variant font-mono text-xs border border-outline-variant dark:border-outline focus:outline-none resize-none"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(manualPrompt);
                          window.open('https://gemini.google.com/app', '_blank');
                        }}
                        className="absolute right-2 top-2 p-1.5 rounded-md btn-orange hover:opacity-90 transition-opacity"
                        title="프롬프트 복사 및 Gemini 열기"
                      >
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1 sm:gap-base">
                    <div className="flex items-center justify-between">
                      <label className="font-medium text-on-surface dark:text-on-dark-surface text-xs sm:text-label-sm">2. AI 답변을 붙여넣어 주세요.</label>
                      <button
                        onClick={async () => {
                          try {
                            if (Capacitor.isNativePlatform()) {
                              const { value } = await Clipboard.read();
                              if (value) {
                                setManualText(value);
                              }
                            } else {
                              const text = await navigator.clipboard.readText();
                              setManualText(text);
                            }
                          } catch (err) {
                            console.error('Failed to read clipboard contents: ', err);
                          }
                        }}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-orange-500 dark:bg-orange-600 text-white rounded hover:bg-orange-600 dark:hover:bg-orange-700 transition-colors"
                        title="클립보드 내용 붙여넣기"
                      >
                        <span className="material-symbols-outlined text-[16px]">content_paste</span>
                        붙여넣기
                      </button>
                    </div>
                    <textarea
                      className="w-full h-32 p-3 rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring font-mono text-sm sm:text-base resize-y"
                      value={manualText}
                      onChange={e => setManualText(e.target.value)}
                    />
                  </div>
                </div>

                {/* 에러 메시지 */}
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-error-container text-on-error-container text-xs sm:text-sm">
                    <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
                    {error}
                  </div>
                )}

                {/* 자동 파싱 안내 메시지 */}
                <div className="text-center text-xs text-on-surface-variant dark:text-on-dark-surface-variant">
                  유효한 JSON 형식이 입력되면 아래에 미리보기가 표시됩니다.
                </div>
              </>
            )}
          </div>
        </section>

        {preview.length > 0 && (
          <section 
            className="rounded-xl shadow-sm border border-outline-variant dark:border-outline p-4 sm:p-lg transition-colors duration-200"
            style={{ background: 'var(--surface)' }}
          >
            <div className="flex items-center justify-between mb-3 sm:mb-md">
              <h3 className="text-base sm:text-title-md font-semibold text-on-surface dark:text-on-dark-surface">
                생성된 문장 미리보기 ({preview.length}개)
              </h3>
            </div>
            <div className="space-y-2 sm:space-y-sm mb-4 sm:mb-md max-h-72 overflow-y-auto pr-1">
              {preview.map((s, i) => (
                <div key={i} className="p-3 sm:p-md rounded-lg border border-outline-variant dark:border-outline space-y-1">
                  <p className="text-sm sm:text-body-md text-on-surface dark:text-on-dark-surface font-medium">{s.en}</p>
                  <p className="text-xs sm:text-body-md text-on-surface-variant dark:text-on-dark-surface-variant">{s.ko}</p>
                </div>
              ))}
            </div>

            {/* 롤플레이 질문 생성 상태 */}
            {generatingQuestions ? (
              <div className="flex items-center gap-2 mb-3 p-3 rounded-lg" style={{ background: 'var(--teal-tint)', color: 'var(--teal-deep)', fontSize: '13px' }}>
                <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                롤플레이 연습 질문 10개 생성 중...
              </div>
            ) : previewQuestions.length > 0 ? (
              <div className="flex items-center gap-2 mb-3 p-3 rounded-lg" style={{ background: 'var(--teal-tint)', color: 'var(--teal-deep)', fontSize: '13px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>record_voice_over</span>
                <span>롤플레이 연습 질문 {previewQuestions.length}개도 함께 저장됩니다.</span>
              </div>
            ) : null}

            <button
              onClick={handleApply}
              className="btn-orange w-full h-11 rounded-xl text-sm sm:text-label-md font-medium active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              disabled={generatingQuestions}
            >
              <span className="material-symbols-outlined text-xl">playlist_add_check</span>
              {generatingQuestions ? '질문 생성 완료 후 적용 가능...' : '학습 목록에 적용하고 학습 시작'}
            </button>
          </section>
        )}

      </div>
    </div>
  );
}
