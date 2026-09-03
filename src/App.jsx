import { useState } from 'react';
import { usePersistentState } from './hooks/usePersistentState';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import SetupTab from './components/SetupTab';
import CreateTab from './components/CreateTab';
import StudyTab from './components/StudyTab';
import Footer from './components/Footer';

function App() {
  const [activeTab, setActiveTab] = usePersistentState('linguist-active-tab', 'study');

  // ── 공유 상태 ──────────────────────────────
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('linguist-api-key') || ''; }
    catch (e) { return ''; }
  });
  const [sentences, setSentences] = usePersistentState('linguist-sentences', [
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

  return (
    <div className="frame" id="frame">
      <Header total={sentences.length} progress={Math.min(3, sentences.length)} />
      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="content">
        {activeTab === 'study'  && <StudyTab sentences={sentences} apiKey={apiKey} />}
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
          />
        )}
      </div>
    </div>
  );
}

export default App;
