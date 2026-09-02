import { useState } from 'react';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import SetupTab from './components/SetupTab';
import CreateTab from './components/CreateTab';
import StudyTab from './components/StudyTab';
import Footer from './components/Footer';

function App() {
  const [activeTab, setActiveTab] = useState('study');

  // ── 공유 상태 ──────────────────────────────
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('linguist-api-key') || ''; }
    catch { return ''; }
  });
  const [ttsApiKey, setTtsApiKey] = useState(() => {
    try { return localStorage.getItem('linguist-tts-key') || ''; }
    catch { return ''; }
  });
  const [sentences, setSentences] = useState([
    { en: 'Excuse me, where is the nearest train station?', ko: '실례합니다, 가장 가까운 기차역이 어디에 있나요?' },
    { en: 'I would like to book a table for two at 7 PM.', ko: '오후 7시에 두 명 자리를 예약하고 싶습니다.' },
    { en: 'Could you please speak a little slower?', ko: '조금만 더 천천히 말씀해 주시겠어요?' },
  ]);

  const handleSaveKey = (key) => {
    try {
      if (key) localStorage.setItem('linguist-api-key', key);
      else localStorage.removeItem('linguist-api-key');
    } catch (e) { console.warn('localStorage 비활성화됨'); }
    setApiKey(key);
  };

  const handleSaveTtsKey = (key) => {
    try {
      if (key) localStorage.setItem('linguist-tts-key', key);
      else localStorage.removeItem('linguist-tts-key');
    } catch (e) { console.warn('localStorage 비활성화됨'); }
    setTtsApiKey(key);
  };

  return (
    <div className="bg-background dark:bg-dark-bg text-on-background dark:text-on-dark-surface min-h-screen flex flex-col font-body-md transition-colors duration-200">
      <Header />
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-3 sm:px-gutter md:px-lg py-4 sm:py-lg">
        <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
        {activeTab === 'study'  && <StudyTab sentences={sentences} apiKey={ttsApiKey} />}
        {activeTab === 'create' && (
          <CreateTab
            apiKey={apiKey}
            onGenerate={(s) => { setSentences(s); setActiveTab('study'); }}
          />
        )}
        {activeTab === 'setup' && (
          <SetupTab
            apiKey={apiKey}
            onSave={handleSaveKey}
            ttsApiKey={ttsApiKey}
            onSaveTts={handleSaveTtsKey}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}

export default App;
