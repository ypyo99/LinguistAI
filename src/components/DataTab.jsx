import { useState, useEffect } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';

const FOLDER_ID = '1q1aY9ht38J3JYYaiSq0nMTmn_zug2Wvq';

export default function DataTab({ setUser: appSetUser, setSentences, setPackTitle, setStudiedIndices }) {
  const [user, setUser] = usePersistentState('linguist-user', null);
  const [downloaded, setDownloaded] = useState({});
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user && user.accessToken) {
      const fetchFiles = async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch(
            `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+trashed=false&orderBy=name&fields=files(id,name,description)`,
            { headers: { Authorization: `Bearer ${user.accessToken}` } }
          );
          if (res.status === 401) {
            setUser(null);
            if (appSetUser) appSetUser(null);
            alert('구글 로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
            return;
          }
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);
          setPacks(data.files || []);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchFiles();
    }
  }, [user]);

  const handleDownload = async (pack) => {
    if (!user || !user.accessToken) return;
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${pack.id}?alt=media`, {
        headers: { Authorization: `Bearer ${user.accessToken}` }
      });
      if (res.status === 401) {
        setUser(null);
        if (appSetUser) appSetUser(null);
        alert('구글 로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('유효한 JSON 배열 형식이 아닙니다.');
      
      // 메모리에 저장되어 있던 학습데이터 대체
      setSentences(parsed);
      
      // 파일명 기반으로 타이틀 업데이트 (ex: 여행영어-초급-50.txt -> 여행영어-초급 50개)
      let titleName = pack.name.replace(/\.json$/, '').replace(/\.txt$/, '');
      const match = titleName.match(/^(.*?)-(\d+)$/);
      if (match) {
        setPackTitle(`${match[1]} ${match[2]}개`);
      } else {
        setPackTitle(`${titleName} ${parsed.length}개`);
      }
      
      // 학습 현황 초기화
      setStudiedIndices([]);
      
      setDownloaded(prev => ({ ...prev, [pack.id]: true }));
      alert(`"${pack.name}" 패키지가 적용되었습니다!`);
    } catch (err) {
      console.error(err);
      alert(`다운로드 중 오류가 발생했습니다: ${err.message}`);
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

  return (
    <div className="tab-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', background: 'var(--teal-tint)', padding: '16px', borderRadius: '16px' }}>
        <img src={user.picture} alt="profile" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
        <div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--teal-deep)' }}>{user.name}님 환영합니다!</div>
          <div style={{ fontSize: '13px', color: 'var(--ink)' }}>프리미엄 학습 데이터를 무료로 다운로드하세요.</div>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-soft)' }}>
          <i className="material-symbols-outlined" style={{ fontSize: '32px', animation: 'spin 1s linear infinite' }}>autorenew</i>
          <p style={{ marginTop: '12px', fontSize: '14px' }}>드라이브에서 데이터를 불러오는 중...</p>
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', color: '#EF4444', borderRadius: '12px', fontSize: '14px', marginBottom: '20px' }}>
          <strong>오류 발생:</strong> {error}
          <br/><br/>
          Google Cloud Console에서 Google Drive API가 활성화되어 있는지 확인해 주세요.
        </div>
      )}

      {!loading && !error && packs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-soft)', fontSize: '14px' }}>
          해당 구글 드라이브 폴더에 파일이 없습니다.
        </div>
      )}

      {!loading && !error && packs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {packs.map(pack => (
            <div key={pack.id} style={{ background: 'var(--surface)', border: '0.5px solid var(--line)', padding: '16px 20px', borderRadius: '16px', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pack.name.replace('.json', '')}</h3>
                {pack.description && (
                  <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: '4px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pack.description}</p>
                )}
              </div>
              <button 
                onClick={() => handleDownload(pack)}
                disabled={downloaded[pack.id]}
                className={downloaded[pack.id] ? "" : "btn-orange"}
                style={{
                  flexShrink: 0,
                  padding: '10px 16px', borderRadius: '10px', border: 'none',
                  background: downloaded[pack.id] ? 'var(--line)' : 'var(--teal)',
                  color: downloaded[pack.id] ? 'var(--ink-soft)' : '#fff',
                  fontSize: '13.5px', fontWeight: '700', cursor: downloaded[pack.id] ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <i className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {downloaded[pack.id] ? "check_circle" : "download"}
                </i>
                {downloaded[pack.id] ? '완료' : '다운로드'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
