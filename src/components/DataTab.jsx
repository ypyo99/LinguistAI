import { useState, useEffect, useMemo } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { getStoreFolderId, deletePackFile } from '../utils/googleDrive';
import { showAuthAlert } from '../utils/authAlert';

// 난이도 뱃지 스타일
const LEVEL_BADGE = {
  '초급': { bg: '#DCFCE7', color: '#16A34A' },
  '중급': { bg: '#FEF9C3', color: '#CA8A04' },
  '고급': { bg: '#FEE2E2', color: '#DC2626' },
};

function parseName(rawName) {
  const name = rawName.replace(/\.json$/i, '').replace(/\.txt$/i, '');
  let level = null;
  for (const key of Object.keys(LEVEL_BADGE)) {
    if (name.includes(key)) { level = key; break; }
  }
  const countMatch = name.match(/[-\s](\d+)개?$/);
  const count = countMatch ? countMatch[1] : null;
  const base = name
    .replace(/초급|중급|고급/g, '')
    .replace(/[-\s]\d+개?$/, '')
    .replace(/-+$/, '')
    .trim();
  return { base, level, count };
}

const DIFFICULTY_MAP = { '초급': 'beginner (A1-A2)', '중급': 'intermediate (B1-B2)', '고급': 'advanced (C1-C2)' };

export default function DataTab({ apiKey, setUser: appSetUser, setSentences, setPackTitle, setStudiedIndices, setCurrentPackId, setFavorites, setRoleplayQuestions }) {
  const [user, setUser] = usePersistentState('linguist-user', null);
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 한글 입력(IME) 시 버벅임 및 자음/모음 분리 방지를 위한 디바운스
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 150);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const fetchFiles = async () => {
    if (!user || !user.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const folderId = await getStoreFolderId(user.accessToken);
      if (!folderId) { setPacks([]); setLoading(false); return; }
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}&orderBy=name&fields=files(id,name,description,owners(displayName,me))`,
        { headers: { Authorization: `Bearer ${user.accessToken}` } }
      );
      if (res.status === 401) {
        showAuthAlert('TOKEN_EXPIRED', setUser);
        if (appSetUser) appSetUser(null);
        return;
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      setPacks(data.files || []);
    } catch (err) {
      if (err.code === 'TOKEN_EXPIRED' || err.code === 'SCOPE_INSUFFICIENT') {
        showAuthAlert(err.code, setUser);
        if (appSetUser) appSetUser(null);
      } else { setError(err.message); }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchFiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleDownload = async (pack) => {
    if (!user || !user.accessToken || loadingId) return;
    setLoadingId(pack.id);
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${pack.id}?alt=media`, {
        headers: { Authorization: `Bearer ${user.accessToken}` }
      });
      if (res.status === 401) {
        showAuthAlert('TOKEN_EXPIRED', setUser);
        if (appSetUser) appSetUser(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = JSON.parse(text);
      let sentencesData = null;
      let titleName = pack.name.replace(/\.json$/i, '').replace(/\.txt$/i, '');
      let studiedData = [], favoritesData = [], roleplayData = [];
      if (Array.isArray(parsed)) {
        sentencesData = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.sentences)) {
        sentencesData = parsed.sentences;
        if (parsed.title) titleName = parsed.title;
        if (parsed.studiedIndices) studiedData = parsed.studiedIndices;
        if (parsed.favorites) favoritesData = parsed.favorites;
        if (parsed.roleplayQuestions) roleplayData = parsed.roleplayQuestions;
      } else { throw new Error('유효한 JSON 배열 형식이 아닙니다.'); }
      setSentences(sentencesData);
      setPackTitle(titleName);
      setStudiedIndices(studiedData);
      if (setFavorites) setFavorites(favoritesData);
      if (setRoleplayQuestions) setRoleplayQuestions(roleplayData);
      if (setCurrentPackId) setCurrentPackId(null);
      alert(`"${titleName}" 패키지가 적용되었습니다!`);
    } catch (err) {
      console.error(err);
      alert(`다운로드 중 오류가 발생했습니다: ${err.message}`);
    } finally { setLoadingId(null); }
  };

  const handleDeleteStorePack = async (pack) => {
    if (!confirm('이 자료를 스토어에서 정말 삭제하시겠습니까?')) return;
    setLoadingId(pack.id);
    try {
      await deletePackFile(user.accessToken, pack.id);
      setPacks(packs.filter(p => p.id !== pack.id));
      alert('스토어에서 삭제되었습니다.');
    } catch (err) {
      if (err.code === 'TOKEN_EXPIRED' || err.code === 'SCOPE_INSUFFICIENT') {
        showAuthAlert(err.code, setUser);
        if (appSetUser) appSetUser(null);
      } else {
        alert(`삭제 중 오류가 발생했습니다: ${err.message}`);
      }
    } finally {
      setLoadingId(null);
    }
  };


  if (!user) {
    return (
      <div className="tab-fade-in" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <i className="material-symbols-outlined" style={{ fontSize: '64px', color: 'var(--amber)', marginBottom: '16px' }}>lock</i>
        <h2 className="section-heading" style={{ fontSize: '20px' }}>프리미엄 학습 데이터</h2>
        <p className="section-sub" style={{ fontSize: '14px', lineHeight: '1.6', marginTop: '12px' }}>
          LinguistAI를 구매하신 프리미엄 회원이신가요?<br/>
          <strong>우측 상단의 사람 아이콘을 눌러 구글 계정으로 로그인</strong>하면<br/>
          고품질 영어 학습 팩을 다운로드할 수 있습니다.
        </p>
      </div>
    );
  }

  const sortPacks = (packs) => [...packs].sort((a, b) => {
    const titleA = a.name || '', titleB = b.name || '';
    const baseA = titleA.replace(/\.json$/i, '').replace(/\.txt$/i, '').replace(/초급|중급|고급/g, '').trim();
    const baseB = titleB.replace(/\.json$/i, '').replace(/\.txt$/i, '').replace(/초급|중급|고급/g, '').trim();
    const baseDiff = baseA.localeCompare(baseB);
    if (baseDiff !== 0) return baseDiff;
    const getLevel = (t) => t.includes('초급') ? 1 : t.includes('중급') ? 2 : t.includes('고급') ? 3 : 4;
    const levelDiff = getLevel(titleA) - getLevel(titleB);
    return levelDiff;
  });

  const displayPacks = useMemo(() => {
    const filtered = packs.filter((pack) => {
      if (!searchQuery) return true;
      const { base, level } = parseName(pack.name);
      const uploader = pack.owners?.[0]?.displayName || '';
      const q = searchQuery.toLowerCase();
      
      return (
        (base && base.toLowerCase().includes(q)) ||
        (level && level.toLowerCase().includes(q)) ||
        (uploader && uploader.toLowerCase().includes(q)) ||
        (pack.name && pack.name.toLowerCase().includes(q))
      );
    });
    return sortPacks(filtered);
  }, [packs, searchQuery]);

  return (
    <div className="tab-fade-in" style={{ paddingBottom: '40px' }}>
      {/* 사용자 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', background: '#FFF7ED', border: '1px solid #FDBA74', padding: '12px 16px', borderRadius: '14px' }}>
        <img src={user.picture} alt="profile" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#EA580C' }}>{user.name}님 환영합니다!</div>
          <div style={{ fontSize: '12px', color: '#9A3412' }}>프리미엄 학습 데이터를 적용하세요.</div>
        </div>
        <button 
          onClick={fetchFiles}
          disabled={loading}
          style={{ background: 'transparent', border: 'none', color: '#EA580C', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.5 : 1 }}
        >
          <i className="material-symbols-outlined" style={{ fontSize: '24px', animation: loading ? 'spin 1s linear infinite' : 'none' }}>refresh</i>
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-soft)' }}>
          <i className="material-symbols-outlined" style={{ fontSize: '32px', animation: 'spin 1s linear infinite' }}>autorenew</i>
          <p style={{ marginTop: '12px', fontSize: '14px' }}>드라이브에서 데이터를 불러오는 중...</p>
        </div>
      )}

      {error && (
        <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.08)', color: '#EF4444', borderRadius: '12px', fontSize: '13px', marginBottom: '16px' }}>
          <strong>오류 발생:</strong> {error}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && !error && packs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-soft)', fontSize: '14px' }}>
          <i className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--amber)', marginBottom: '12px' }}>folder_off</i>
          <p style={{ margin: 0, lineHeight: '1.6' }}>
            구글 드라이브의 <strong>LinguistAI/스토어</strong> 폴더에 파일이 없습니다.<br/>
            관리자가 파일을 추가하면 여기에 표시됩니다.
          </p>
        </div>
      )}

      {/* 검색 바 */}
      {!loading && !error && packs.length > 0 && (
        <div style={{ marginBottom: '16px', position: 'relative' }}>
          <i className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: 'var(--ink-soft)' }}>search</i>
          <input
            type="text"
            placeholder="제목, 난이도, 업로더로 검색..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 38px',
              borderRadius: '12px',
              border: '1px solid var(--line)',
              background: 'var(--surface-container-lowest)',
              color: 'var(--ink)',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      )}

      {/* 검색 결과 없음 */}
      {!loading && !error && packs.length > 0 && displayPacks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--ink-soft)', fontSize: '14px' }}>
          <p style={{ margin: 0 }}>검색 결과가 없습니다.</p>
        </div>
      )}

      {/* 컴팩트 2열 그리드 */}
      {!loading && !error && displayPacks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {displayPacks.map(pack => {
            const { base, level, count } = parseName(pack.name);
            const badge = level ? LEVEL_BADGE[level] : null;
            const isDown = loadingId === pack.id;
            return (
              <div
                key={pack.id}
                style={{
                  background: 'var(--surface)',
                  border: '0.5px solid var(--line)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow)',
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                {/* 왼쪽 정보 영역 */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '0 1 auto', minWidth: 0 }}>
                      {base}
                    </div>
                    {pack.owners?.[0]?.me && (
                      <button
                        onClick={() => handleDeleteStorePack(pack)}
                        disabled={!!loadingId}
                        title="스토어에서 삭제"
                        style={{
                          width: '24px', height: '24px', flexShrink: 0,
                          borderRadius: '6px', border: 'none', background: 'transparent',
                          color: '#EF4444', cursor: loadingId ? 'wait' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                        }}
                      >
                        <i className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</i>
                      </button>
                    )}
                  </div>
                  
                  {/* 메타 데이터 한 줄 표시 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                    {badge && (
                      <span style={{
                        fontSize: '9px', fontWeight: '700', padding: '2px 5px',
                        borderRadius: '20px', background: badge.bg, color: badge.color,
                        flexShrink: 0,
                      }}>
                        {level}
                      </span>
                    )}
                    {count && (
                      <span style={{ fontSize: '10px', color: 'var(--ink)', opacity: 0.9, fontWeight: '600', flexShrink: 0 }}>
                        {count}문장
                      </span>
                    )}
                    {pack.owners?.[0]?.displayName && (
                      <span style={{ fontSize: '10px', color: 'var(--ink)', opacity: 0.9, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px', flex: '0 1 auto', minWidth: 0 }}>
                        <i className="material-symbols-outlined" style={{ fontSize: '12px', color: 'var(--teal)', flexShrink: 0 }}>person</i>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pack.owners[0].displayName}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 오른쪽 버튼들 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginTop: '-2px' }}>
                  <button
                    onClick={() => handleDownload(pack)}
                    disabled={!!loadingId}
                    title={`${base} 적용`}
                    style={{
                      width: '24px', height: '24px',
                      borderRadius: '7px', border: 'none',
                      background: isDown ? '#FED7AA' : '#F97316',
                      color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: loadingId ? 'wait' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    <i className="material-symbols-outlined" style={{ fontSize: '14px', animation: isDown ? 'spin 1s linear infinite' : 'none' }}>
                      {isDown ? 'autorenew' : 'play_arrow'}
                    </i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}


    </div>
  );
}
