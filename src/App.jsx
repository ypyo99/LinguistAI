import { useState, useEffect, useRef } from 'react';
import { usePersistentState } from './hooks/usePersistentState';
import { savePack } from './utils/googleDrive';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import SetupTab from './components/SetupTab';
import CreateTab from './components/CreateTab';
import StudyTab from './components/StudyTab';
import QuizTab from './components/QuizTab';
import DataTab from './components/DataTab';
import LibraryTab from './components/LibraryTab';
import RoleplayTab from './components/RoleplayTab';
import Footer from './components/Footer';

function App() {
  const [activeTab, setActiveTab] = usePersistentState('linguist-active-tab', 'study');
  const [user, setUser] = usePersistentState('linguist-user', null);
  const prevUserRef = useRef(user);

  useEffect(() => {
    const prevUser = prevUserRef.current;
    if (!prevUser && user) {
      // User just logged in
      setActiveTab('library');
    } else if (prevUser && !user) {
      // User just logged out
      if (activeTab === 'store' || activeTab === 'library') {
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
    { en: 'Excuse me, where is the nearest train station?', ko: '실례합니다, 가장 가까운 기차역이 어디에 있나요?', vocab: { "nearest": "가장 가까운", "station": "기차역", "where": "어디에" } },
    { en: 'I would like to book a table for two at 7 PM.', ko: '저녁 7시에 두 명 자리 예약하고 싶습니다.', vocab: { "book": "예약하다", "table": "테이블, 자리", "would like": "~하고 싶다" } },
    { en: 'Could you please speak a little slower?', ko: '조금만 더 천천히 말씀해 주시겠어요?', vocab: { "speak": "말하다", "slower": "더 천천히", "little": "조금" } },
  ]);
  
  const [packTitle, setPackTitle] = usePersistentState('linguist-pack-title', '');
  const actualPackTitle = packTitle === '기본 학습 데이터 3개' ? '' : packTitle;
  
  // 기존에 잘못 저장된 "-50개 50개" 와 같은 중복 개수 표기 제거
  const cleanedTitle = actualPackTitle.replace(/(-\d+개?) \d+개$/, '$1');
  
  const displayTitle = cleanedTitle || (sentences.length === 3 ? '기본 학습 데이터' : `저장된 학습 데이터 ${sentences.length}개`);
  const [studiedIndices, setStudiedIndices] = usePersistentState('linguist-studied-indices', []);
  const [favorites, setFavorites] = usePersistentState('linguist-study-favorites', []);
  const [savedPacks, setSavedPacks] = usePersistentState('linguist-saved-packs', []);
  const [currentPackId, setCurrentPackId] = usePersistentState('linguist-current-pack-id', null);
  const [roleplayQuestions, setRoleplayQuestions] = usePersistentState('linguist-roleplay-questions', []);

  // ── 스트릭 (연속 학습일) 관리 ──────────────────────────
  const [streak, setStreak] = usePersistentState('linguist-streak', 0);
  const [lastStudyDate, setLastStudyDate] = usePersistentState('linguist-last-study', null);

  // 앱 실행 시, 마지막 학습일이 어제보다 이전이면 스트릭 초기화
  useEffect(() => {
    if (lastStudyDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parts = lastStudyDate.split('-');
      if (parts.length === 3) {
        const last = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const diffDays = Math.round((today - last) / (1000 * 60 * 60 * 24));
        if (diffDays > 1 && streak > 0) {
          setStreak(0);
        }
      }
    }
  }, []); // 컴포넌트 마운트 시 1회 실행

  // 진도가 올라갈 때(학습 시) 스트릭 업데이트
  useEffect(() => {
    if (studiedIndices.length > 0) {
      const now = new Date();
      const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      if (lastStudyDate !== localTodayStr) {
        if (!lastStudyDate) {
          setStreak(1);
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const parts = lastStudyDate.split('-');
          const last = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          const diffDays = Math.round((today - last) / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            setStreak(prev => prev + 1);
          } else if (diffDays > 1) {
            setStreak(1); // 이틀 이상 지났으면 1로 리셋
          }
        }
        setLastStudyDate(localTodayStr);
      }
    }
  }, [studiedIndices.length, lastStudyDate, setLastStudyDate, setStreak]);

  useEffect(() => {
    if (currentPackId && savedPacks.length > 0) {
      setSavedPacks(prev => {
        const pack = prev.find(p => p.id === currentPackId);
        if (!pack) return prev;
        
        const hasChanged = 
          JSON.stringify(pack.favorites) !== JSON.stringify(favorites) ||
          JSON.stringify(pack.studiedIndices) !== JSON.stringify(studiedIndices) ||
          pack.title !== displayTitle ||
          JSON.stringify(pack.sentences) !== JSON.stringify(sentences) ||
          JSON.stringify(pack.roleplayQuestions) !== JSON.stringify(roleplayQuestions);
          
        if (!hasChanged) return prev;

        return prev.map(p => 
          p.id === currentPackId 
            ? { ...p, favorites, studiedIndices, title: displayTitle, sentences, roleplayQuestions } 
            : p
        );
      });
    }
  }, [favorites, studiedIndices, displayTitle, sentences, roleplayQuestions, currentPackId, setSavedPacks, savedPacks.length]);

  const handleSavePack = async () => {
    if (sentences.length === 0) return;

    if (user?.accessToken) {
      // ── 구글 드라이브에 저장 ──────────────────────────────────
      const pack = currentPackId
        ? savedPacks.find(p => p.id === currentPackId) || {
            id: currentPackId,
            title: displayTitle,
            sentences,
            favorites,
            studiedIndices,
            createdAt: new Date().toISOString()
          }
        : {
            id: Date.now().toString(),
            title: displayTitle,
            sentences,
            favorites,
            studiedIndices,
            createdAt: new Date().toISOString()
          };

      // 현재 내용으로 pack 갱신
      const packToSave = { ...pack, title: displayTitle, sentences, favorites, studiedIndices, roleplayQuestions };

      try {
        await savePack(user.accessToken, packToSave);
        if (!currentPackId) setCurrentPackId(packToSave.id);
        alert('구글 드라이브 보관함에 저장되었습니다!');
      } catch (err) {
        if (err.code === 'TOKEN_EXPIRED') {
          setUser(null);
          alert('구글 로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
        } else {
          alert(`저장 중 오류가 발생했습니다: ${err.message}`);
        }
      }
    } else {
      // ── 로컬 저장소에 저장 (비로그인) ───────────────────────
      if (currentPackId) {
        setSavedPacks(prev => prev.map(p =>
          p.id === currentPackId
            ? { ...p, title: displayTitle, sentences, favorites, studiedIndices }
            : p
        ));
        alert('현재 보관함에 덮어쓰기 저장되었습니다!');
      } else {
        const newPack = {
          id: Date.now().toString(),
          title: displayTitle,
          sentences,
          favorites,
          studiedIndices,
          roleplayQuestions,
          createdAt: new Date().toISOString()
        };
        setSavedPacks(prev => [newPack, ...prev]);
        setCurrentPackId(newPack.id);
        alert('보관함에 저장되었습니다!');
      }
    }
  };

  const handleSaveKey = (key) => {
    try {
      if (key) localStorage.setItem('linguist-api-key', key);
      else localStorage.removeItem('linguist-api-key');
    } catch (e) { console.warn('localStorage 비활성화됨'); }
    setApiKey(key);
  };

  const [ttsApiKey, setTtsApiKey] = useState(() => {
    try { return localStorage.getItem('linguist-tts-api-key') || ''; }
    catch (e) { return ''; }
  });

  const handleSaveTtsKey = (key) => {
    try {
      if (key) localStorage.setItem('linguist-tts-api-key', key);
      else localStorage.removeItem('linguist-tts-api-key');
    } catch (e) { console.warn('localStorage 비활성화됨'); }
    setTtsApiKey(key);
  };

  return (
    <div className="frame" id="frame">
      <Header 
        title={displayTitle} 
        total={sentences.length} 
        progress={studiedIndices.length} 
        streak={streak}
        onResetProgress={() => setStudiedIndices([])}
      />
      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
      <div className="content">
        <div style={{ display: activeTab === 'study' ? 'block' : 'none' }}>
          <StudyTab sentences={sentences} apiKey={apiKey} ttsApiKey={ttsApiKey} setStudiedIndices={setStudiedIndices} studiedIndices={studiedIndices} favorites={favorites} setFavorites={setFavorites} onSavePack={handleSavePack} user={user} />
        </div>
        <div style={{ display: activeTab === 'roleplay' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <RoleplayTab apiKey={apiKey} ttsApiKey={ttsApiKey} sentences={sentences} roleplayQuestions={roleplayQuestions} setRoleplayQuestions={setRoleplayQuestions} packTitle={displayTitle} />
        </div>
        <div style={{ display: activeTab === 'quiz' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <QuizTab sentences={sentences} />
        </div>
        <div style={{ display: activeTab === 'library' ? 'block' : 'none' }}>
          <LibraryTab
            savedPacks={savedPacks}
            setSavedPacks={setSavedPacks}
            setSentences={setSentences}
            setPackTitle={setPackTitle}
            setFavorites={setFavorites}
            setStudiedIndices={setStudiedIndices}
            setActiveTab={setActiveTab}
            setCurrentPackId={setCurrentPackId}
            setRoleplayQuestions={setRoleplayQuestions}
            user={user}
            onTokenExpired={(reason) => {
              setUser(null);
              if (reason === 'SCOPE_INSUFFICIENT') {
                alert('\uad6c\uae00 \ub4dc\ub77c\uc774\ube0c \uc6f0\ud55c \uad8c\ud55c\uc774 \ubd80\uc871\ud569\ub2c8\ub2e4.\n\ub85c\uadf8\uc544\uc6c3 \ud6c4 \ub2e4\uc2dc \ub85c\uadf8\uc778\ud574 \uc8fc\uc138\uc694.');
              } else {
                alert('\uad6c\uae00 \ub85c\uadf8\uc778 \uc138\uc158\uc774 \ub9cc\ub8cc\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \ub85c\uadf8\uc778\ud574 \uc8fc\uc138\uc694.');
              }
            }}
          />
        </div>
        <div style={{ display: activeTab === 'store' ? 'block' : 'none' }}>
          <DataTab setUser={setUser} setSentences={setSentences} setPackTitle={setPackTitle} setStudiedIndices={setStudiedIndices} setCurrentPackId={setCurrentPackId} setFavorites={setFavorites} setRoleplayQuestions={setRoleplayQuestions} />
        </div>
        <div style={{ display: activeTab === 'create' ? 'block' : 'none' }}>
          <CreateTab
            apiKey={apiKey}
            onGenerate={(s, title, questions) => { 
              setSentences(s); 
              setPackTitle(title || `AI 생성 학습 데이터 ${s.length}개`);
              setRoleplayQuestions(questions || []);
              setStudiedIndices([]);
              setFavorites([]);
              setCurrentPackId(null);
              setActiveTab('study'); 
            }}
          />
        </div>
        <div style={{ display: activeTab === 'setup' ? 'block' : 'none' }}>
          <SetupTab
            apiKey={apiKey}
            onSave={handleSaveKey}
            ttsApiKey={ttsApiKey}
            onSaveTtsKey={handleSaveTtsKey}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default App;
