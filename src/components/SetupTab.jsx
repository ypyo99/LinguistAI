export default function SetupTab({ apiKey, onSave }) {
  // Gemini API Key State
  const [input, setInput] = useState(apiKey || '');
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(input ? input.trim() : '');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
            <button onClick={handleSave} disabled={!input || !input.trim()}
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
    </div>
  );
}
