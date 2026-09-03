import { useState, useEffect, useRef } from 'react';
import { usePersistentState } from './hooks/usePersistentState';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import SetupTab from './components/SetupTab';
import CreateTab from './components/CreateTab';
import StudyTab from './components/StudyTab';
import DataTab from './components/DataTab';
import Footer from './components/Footer';

function App() {
  const [activeTab, setActiveTab] = usePersistentState('linguist-active-tab', 'study');
  const [user] = usePersistentState('linguist-user', null);
  const prevUserRef = useRef(user);

  useEffect(() => {
    const prevUser = prevUserRef.current;
    if (!prevUser && user) {
      // User just logged in
      setActiveTab('store');
    } else if (prevUser && !user) {
      // User just logged out
      if (activeTab === 'store') {
        setActiveTab('study');
      }
    }
    prevUserRef.current = user;
  }, [user, activeTab, setActiveTab]);

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
  const [packTitle, setPackTitle] = usePersistentState('linguist-pack-title', '기본 학습 데이터 3개');
  const [studiedIndices, setStudiedIndices] = usePersistentState('linguist-studied-indices', []);

  const handleSaveKey = (key) => {
    try {
      if (key) localStorage.setItem('linguist-api-key', key);
      else localStorage.removeItem('linguist-api-key');
    } catch (e) { console.warn('localStorage 비활성화됨'); }
    setApiKey(key);
  };

  return (
    <div className="frame" id="frame">
      <Header title={packTitle} total={sentences.length} progress={studiedIndices.length} />
      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
      <div className="content">
        <div style={{ display: activeTab === 'study' ? 'block' : 'none' }}>
          <StudyTab sentences={sentences} apiKey={apiKey} setStudiedIndices={setStudiedIndices} studiedIndices={studiedIndices} />
        </div>
        <div style={{ display: activeTab === 'store' ? 'block' : 'none' }}>
          <DataTab setSentences={setSentences} setPackTitle={setPackTitle} setStudiedIndices={setStudiedIndices} />
        </div>
        <div style={{ display: activeTab === 'create' ? 'block' : 'none' }}>
          <CreateTab
            apiKey={apiKey}
            onGenerate={(s) => { 
              setSentences(s); 
              setPackTitle(`AI 생성 학습 데이터 ${s.length}개`);
              setStudiedIndices([]);
              setActiveTab('study'); 
            }}
          />
        </div>
        <div style={{ display: activeTab === 'setup' ? 'block' : 'none' }}>
          <SetupTab
            apiKey={apiKey}
            onSave={handleSaveKey}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
