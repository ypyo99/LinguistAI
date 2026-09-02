import { useState } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';

const DIFFICULTY_MAP = { '초급': 'beginner (A1-A2)', '중급': 'intermediate (B1-B2)', '고급': 'advanced (C1-C2)' };

export default function CreateTab({ apiKey, onGenerate }) {
  const [topic, setTopic] = usePersistentState('linguist-create-topic', '');
  const [difficulty, setDifficulty] = usePersistentState('linguist-create-difficulty', '초급');
  const [count, setCount] = usePersistentState('linguist-create-count', 5);
  const [model, setModel] = usePersistentState('linguist-create-model', 'gemini-3.6-flash');
  const [loading, setLoading] = useState(false);
  const [generatingCount, setGeneratingCount] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = usePersistentState('linguist-create-preview', []);

  const handleGenerate = async () => {
    if (!apiKey) {
      setError('⚠️ 설정 탭에서 Gemini API 키를 먼저 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');
    setPreview([]);

    const prompt = `Generate exactly ${count} English learning sentences for a Korean learner.
Topic: "${topic || '일상 회화'}"
Level: ${DIFFICULTY_MAP[difficulty]}
Rules:
- Each sentence must be natural, practical, and appropriate for the level
- Korean translation must be accurate and natural
- Return ONLY a valid JSON array, no markdown fences, no explanation
Format: [{"en":"English sentence here","ko":"Korean translation here"}]`;

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
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
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
      if (!jsonMatch) throw new Error('응답에서 JSON 형식을 찾을 수 없습니다. 다시 시도해 주세요.');

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('유효한 문장 데이터를 받지 못했습니다.');

      setPreview(parsed);
    } catch (e) {
      setError(`오류: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (preview.length > 0) onGenerate(preview);
  };

  return (
    <div className="tab-fade-in">
      <div className="max-w-2xl mx-auto flex flex-col gap-4 sm:gap-lg">
        {/* 입력 패널 */}
        <section className="bg-surface-container-lowest dark:bg-dark-surface rounded-xl shadow-sm border border-outline-variant dark:border-outline p-4 sm:p-lg transition-colors duration-200">
          <h2 className="text-base sm:text-title-md font-semibold mb-4 sm:mb-md text-on-surface dark:text-on-dark-surface">
            학습 문장 생성
          </h2>

          <div className="space-y-3 sm:space-y-md">
            {/* 주제 */}
            <div className="flex items-center gap-3 sm:gap-4">
              <label className="text-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant whitespace-nowrap min-w-[60px]" htmlFor="topic">
                주제 <span className="opacity-60 text-xs font-normal">(선택)</span>
              </label>
              <input
                className="flex-1 w-full h-10 sm:h-11 px-3 sm:px-md rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring placeholder:text-outline-variant dark:placeholder:text-on-dark-surface-variant transition-colors duration-200 text-sm sm:text-base"
                id="topic"
                placeholder="예: 비즈니스 미팅, 여행, 음식 주문..."
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              />
            </div>

            {/* 난이도 + 문장 개수 + AI 모델 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-md">
              <div className="flex items-center gap-2 sm:gap-3">
                <label className="text-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant whitespace-nowrap min-w-[60px]" htmlFor="difficulty">
                  난이도
                </label>
                <select
                  className="flex-1 w-full h-10 sm:h-11 px-3 sm:px-md rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring transition-colors duration-200 text-sm sm:text-base"
                  id="difficulty"
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value)}
                >
                  <option>초급</option>
                  <option>중급</option>
                  <option>고급</option>
                </select>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <label className="text-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant whitespace-nowrap min-w-[60px]" htmlFor="count">
                  문장 개수
                </label>
                <input
                  className="flex-1 w-full h-10 sm:h-11 px-3 sm:px-md rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring transition-colors duration-200 text-sm sm:text-base"
                  id="count"
                  max="20"
                  min="1"
                  type="number"
                  value={count}
                  onChange={e => setCount(Number(e.target.value))}
                />
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <label className="text-sm font-medium text-on-surface-variant dark:text-on-dark-surface-variant whitespace-nowrap min-w-[60px]" htmlFor="model">
                  AI 모델
                </label>
                <select
                  className="flex-1 w-full h-10 sm:h-11 px-3 sm:px-md rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-dark-bg text-on-surface dark:text-on-dark-surface input-focus-ring transition-colors duration-200 text-sm sm:text-base"
                  id="model"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                >
                  <option value="gemini-3.6-flash">3.6 Flash</option>
                  <option value="gemini-1.5-pro">1.5 Pro</option>
                  <option value="gemini-2.5-flash">2.5 Flash</option>
                  <option value="gemini-1.5-flash">1.5 Flash</option>
                </select>
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
              className="w-full h-11 bg-primary-container text-on-primary rounded-xl text-sm sm:text-label-md font-medium hover:bg-primary active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
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
          </div>
        </section>

        {/* 미리보기 패널 */}
        {preview.length > 0 && (
          <section className="bg-surface-container-lowest dark:bg-dark-surface rounded-xl shadow-sm border border-outline-variant dark:border-outline p-4 sm:p-lg transition-colors duration-200">
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
            <button
              onClick={handleApply}
              className="w-full h-11 bg-primary text-on-primary rounded-xl text-sm sm:text-label-md font-medium hover:bg-primary/90 active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">playlist_add_check</span>
              학습 목록에 적용하고 학습 시작
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
