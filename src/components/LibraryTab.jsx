import { useState, useEffect, useCallback } from 'react';
import { loadAllPacks, deletePackFile, updatePackTitleAndContent, uploadToStore } from '../utils/googleDrive';
import LongPressButton from './LongPressButton';

// 난이도 뱃지 (DataTab과 동일)
const LEVEL_BADGE = {
  '초급': { bg: '#DCFCE7', color: '#16A34A' },
  '중급': { bg: '#FEF9C3', color: '#CA8A04' },
  '고급': { bg: '#FEE2E2', color: '#DC2626' },
};

function parseName(rawTitle = '') {
  let level = null;
  for (const key of Object.keys(LEVEL_BADGE)) {
    if (rawTitle.includes(key)) { level = key; break; }
  }
  const countMatch = rawTitle.match(/[-\s](\d+)개?$/);
  const count = countMatch ? countMatch[1] : null;
  const base = rawTitle
    .replace(/초급|중급|고급/g, '')
    .replace(/[-\s]\d+개?$/, '')
    .replace(/-+$/, '')
    .trim();
  return { base, level, count };
}

export default function LibraryTab({
  savedPacks = [],
  setSavedPacks,
  setSentences,
  setPackTitle,
  setFavorites,
  setStudiedIndices,
  setActiveTab,
  setCurrentPackId,
  setRoleplayQuestions,
  user,
  onTokenExpired,
}) {
  const [drivePacks, setDrivePacks] = useState([]);
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState(null);
  const [editingPackId, setEditingPackId] = useState(null);
  const [editTitleText, setEditTitleText] = useState('');
  const [savingTitleId, setSavingTitleId] = useState(null);
  const [uploadingStoreId, setUploadingStoreId] = useState(null);

  const isLoggedIn = !!(user?.accessToken);

  const loadFromDrive = useCallback(async () => {
    if (!user?.accessToken) return;
    setDriveLoading(true);
    setDriveError(null);
    try {
      const { packs, driveFiles: files, folderId } = await loadAllPacks(user.accessToken);
      setDrivePacks(packs);
      setDriveFiles(files);
    } catch (err) {
      if (err.code === 'TOKEN_EXPIRED' || err.code === 'SCOPE_INSUFFICIENT') {
        onTokenExpired?.(err.code);
      } else {
        setDriveError(err.message);
      }
    } finally {
      setDriveLoading(false);
    }
  }, [user?.accessToken, onTokenExpired]);

  useEffect(() => {
    if (isLoggedIn) {
      loadFromDrive();
    } else {
      setDrivePacks([]);
      setDriveFiles([]);
      setDriveError(null);
    }
  }, [isLoggedIn, loadFromDrive]);

  const handleLoadPack = (pack) => {
    setSentences(pack.sentences || []);
    setPackTitle(pack.title || '');
    setFavorites(pack.favorites || []);
    setStudiedIndices(pack.studiedIndices || []);
    if (setCurrentPackId) setCurrentPackId(pack.id);
    if (setRoleplayQuestions) setRoleplayQuestions(pack.roleplayQuestions || []);
    setActiveTab('study');
  };

  const handleDeletePack = async (pack) => {
    if (!confirm('이 저장된 데이터를 삭제하시겠습니까?')) return;
    if (isLoggedIn) {
      const fileEntry = driveFiles.find((f) => f.packId === pack.id);
      if (fileEntry) {
        try {
          await deletePackFile(user.accessToken, fileEntry.fileId);
        } catch (err) {
          if (err.code === 'TOKEN_EXPIRED' || err.code === 'SCOPE_INSUFFICIENT') { onTokenExpired?.(err.code); return; }
          alert(`삭제 중 오류: ${err.message}`); return;
        }
      }
      setDrivePacks((prev) => prev.filter((p) => p.id !== pack.id));
      setDriveFiles((prev) => prev.filter((f) => f.packId !== pack.id));
    } else {
      setSavedPacks((prev) => prev.filter((p) => p.id !== pack.id));
    }
  };

  const handleTitleEdit = (pack, base) => {
    setEditingPackId(pack.id);
    setEditTitleText(base || pack.title);
  };

  const handleTitleSave = async (pack) => {
    const newBase = editTitleText.trim();
    const { base, level, count } = parseName(pack.title);
    
    if (!newBase || newBase === base) {
      setEditingPackId(null);
      return;
    }

    setSavingTitleId(pack.id);
    let parts = [newBase];
    if (level) parts.push(level);
    if (count) parts.push(count);
    const newTitle = parts.join('-');
    const updatedPack = { ...pack, title: newTitle };

    try {
      if (isLoggedIn) {
        const fileEntry = driveFiles.find((f) => f.packId === pack.id);
        if (fileEntry) {
          await updatePackTitleAndContent(user.accessToken, fileEntry.fileId, newTitle, updatedPack);
        }
        setDrivePacks(prev => prev.map(p => p.id === pack.id ? updatedPack : p));
      } else {
        setSavedPacks(prev => prev.map(p => p.id === pack.id ? updatedPack : p));
      }
    } catch (err) {
      if (err.code === 'TOKEN_EXPIRED' || err.code === 'SCOPE_INSUFFICIENT') {
        onTokenExpired?.(err.code);
      } else {
        alert(`제목 변경 실패: ${err.message}`);
      }
    } finally {
      setSavingTitleId(null);
      setEditingPackId(null);
    }
  };

  const handleDownloadPack = (pack) => {
    try {
      const { favorites: _f, ...packToDownload } = pack;
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(packToDownload, null, 2));
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      a.setAttribute('download', (pack.title || '학습데이터') + '.json');
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleUploadToStore = async (pack, force = false) => {
    if (!isLoggedIn) {
      alert('공유 자료함에 업로드하려면 로그인이 필요합니다.');
      return;
    }
    if (!force) {
      if (!confirm('공유 자료함에 업로드하시겠습니까?')) return;
    }
    
    setUploadingStoreId(pack.id);
    try {
      await uploadToStore(user.accessToken, pack, force);
      alert('공유 자료함에 추가되었습니다.');
      setUploadingStoreId(null);
    } catch (err) {
      if (err.code === 'ALREADY_EXISTS') {
        setUploadingStoreId(null);
        setTimeout(() => {
          if (confirm('동일한 자료가 공유 자료함에 있습니다. 덮어쓰시겠습니까?')) {
            handleUploadToStore(pack, true);
          }
        }, 10);
      } else {
        setUploadingStoreId(null);
        if (err.code === 'TOKEN_EXPIRED' || err.code === 'SCOPE_INSUFFICIENT') {
          onTokenExpired?.(err.code);
        } else {
          alert(`업로드 중 오류가 발생했습니다: ${err.message}`);
        }
      }
    }
  };

  const sortPacks = (packs) => [...packs].sort((a, b) => {
    const titleA = a.title || '', titleB = b.title || '';
    const baseA = titleA.replace(/초급|중급|고급/g, '').trim();
    const baseB = titleB.replace(/초급|중급|고급/g, '').trim();
    const baseDiff = baseA.localeCompare(baseB);
    if (baseDiff !== 0) return baseDiff;
    const getLevel = (t) => t.includes('초급') ? 1 : t.includes('중급') ? 2 : t.includes('고급') ? 3 : 4;
    const levelDiff = getLevel(titleA) - getLevel(titleB);
    if (levelDiff !== 0) return levelDiff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const displayPacks = sortPacks(isLoggedIn ? drivePacks : savedPacks);

  return (
    <div className="tab-fade-in" style={{ paddingBottom: '40px' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h2 className="section-heading" style={{ fontSize: '20px', margin: 0 }}>내 학습 데이터</h2>
      </div>

      {/* 드라이브 경로 배너 */}
      {isLoggedIn && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#FFF7ED', border: '1px solid #FDBA74',
          borderRadius: '10px', padding: '8px 12px', marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#F97316', fontWeight: 'bold' }}>
            <i className="material-symbols-outlined" style={{ fontSize: '15px' }}>folder</i>
            내 드라이브 › LinguistAI › 보관함
          </div>
          <button
            onClick={loadFromDrive}
            disabled={driveLoading}
            style={{
              background: 'transparent', border: 'none', color: '#EA580C', cursor: driveLoading ? 'wait' : 'pointer', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: driveLoading ? 0.5 : 1
            }}
          >
            <i className="material-symbols-outlined" style={{ fontSize: '20px', animation: driveLoading ? 'spin 1s linear infinite' : 'none' }}>refresh</i>
          </button>
        </div>
      )}

      {/* 로딩 */}
      {isLoggedIn && driveLoading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-soft)' }}>
          <i className="material-symbols-outlined" style={{ fontSize: '32px', animation: 'spin 1s linear infinite' }}>autorenew</i>
          <p style={{ marginTop: '12px', fontSize: '14px' }}>구글 드라이브에서 불러오는 중...</p>
        </div>
      )}

      {/* 에러 */}
      {isLoggedIn && driveError && !driveLoading && (
        <div style={{ padding: '14px', background: 'rgba(239,68,68,0.08)', color: '#EF4444', borderRadius: '12px', fontSize: '13px', marginBottom: '14px' }}>
          <strong>오류 발생:</strong> {driveError}
          <br /><br />
          <button onClick={loadFromDrive} style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>
            다시 시도
          </button>
        </div>
      )}

      {/* 빈 상태 */}
      {!driveLoading && !driveError && displayPacks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-soft)', background: 'var(--surface-container-lowest)', borderRadius: '16px', border: '1px dashed var(--line)' }}>
          <i className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--amber)', marginBottom: '16px' }}>inventory_2</i>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6' }}>
            {isLoggedIn
              ? <>구글 드라이브 내자료함이 비어있습니다.<br/>학습 탭에서 <strong>[내자료함에 저장]</strong> 버튼을 눌러 데이터를 보관해 보세요.</>
              : <>내자료함에 저장된 학습 데이터가 없습니다.<br/>학습 탭에서 <strong>[내자료함에 저장]</strong> 버튼을 눌러 데이터를 보관해 보세요.</>
            }
          </p>
        </div>
      )}

      {/* 컴팩트 2열 그리드 */}
      {!driveLoading && !driveError && displayPacks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {displayPacks.map(pack => {
            const { base, level, count } = parseName(pack.title);
            const badge = level ? LEVEL_BADGE[level] : null;
            return (
              <div
                key={pack.id}
                style={{
                  background: 'var(--surface)',
                  border: '0.5px solid var(--line)',
                  borderRadius: '14px',
                  boxShadow: 'var(--shadow)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {/* 제목 및 즐겨찾기 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  {editingPackId === pack.id ? (
                    <input
                      autoFocus
                      value={editTitleText}
                      onChange={(e) => setEditTitleText(e.target.value)}
                      onBlur={() => handleTitleSave(pack)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTitleSave(pack);
                        if (e.key === 'Escape') setEditingPackId(null);
                      }}
                      disabled={savingTitleId === pack.id}
                      style={{
                        fontSize: '14px', fontWeight: '700', color: 'var(--ink)', 
                        lineHeight: '1.3', width: '100%', 
                        background: 'var(--surface-container-lowest)', 
                        border: '1px solid var(--amber)', borderRadius: '6px', 
                        padding: '2px 6px', outline: 'none'
                      }}
                    />
                  ) : (
                    <div 
                      onClick={() => {
                        if (window.confirm(`'${base || pack.title}${level ? `-${level}` : ''}' 학습자료를 불러올까요?`)) {
                          handleLoadPack(pack);
                        }
                      }}
                      style={{ fontSize: '14px', fontWeight: '700', color: 'var(--ink)', lineHeight: '1.3', wordBreak: 'keep-all', cursor: 'pointer' }}
                      title="클릭하여 학습자료 불러오기"
                    >
                      {base || pack.title} {savingTitleId === pack.id && <i className="material-symbols-outlined" style={{ fontSize: '14px', animation: 'spin 1s linear infinite', verticalAlign: 'middle' }}>autorenew</i>}
                    </div>
                  )}
                  <span style={{ fontSize: '11px', color: 'var(--ink)', opacity: 0.9, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, marginTop: '2px' }}>
                    <i className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--teal)' }}>star</i>
                    {pack.favorites?.length || 0}
                  </span>
                </div>

                {/* 하단 행: 뱃지 + 문장 수 및 액션 버튼들 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <div 
                    onClick={() => {
                      if (window.confirm(`'${base || pack.title}${level ? `-${level}` : ''}' 학습자료를 불러올까요?`)) {
                        handleLoadPack(pack);
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', cursor: 'pointer', flex: 1 }}
                    title="클릭하여 학습자료 불러오기"
                  >
                    {badge && (
                      <span style={{
                        fontSize: '10px', fontWeight: '700', padding: '2px 7px',
                        borderRadius: '20px', background: badge.bg, color: badge.color,
                      }}>
                        {level}
                      </span>
                    )}
                    {count && (
                      <span style={{ fontSize: '11px', color: 'var(--ink)', opacity: 0.9, fontWeight: '600' }}>{count}문장</span>
                    )}
                  </div>

                  {/* 버튼 행 */}
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {/* JSON 다운로드 */}
                    <button
                      onClick={() => handleDownloadPack(pack)}
                      title="JSON 파일로 저장"
                      style={{
                        width: '30px', height: '30px',
                        borderRadius: '9px', border: '1px solid var(--line)',
                        background: 'var(--surface-container-lowest)', color: 'var(--ink-soft)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <i className="material-symbols-outlined" style={{ fontSize: '15px' }}>download</i>
                    </button>
                    {/* 공유 자료함 업로드 */}
                    <button
                      onClick={() => handleUploadToStore(pack)}
                      disabled={uploadingStoreId === pack.id}
                      title="공유 자료함에 업로드"
                      style={{
                        width: '30px', height: '30px',
                        borderRadius: '9px', border: '1px solid var(--line)',
                        background: 'var(--surface-container-lowest)', color: 'var(--ink-soft)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: uploadingStoreId === pack.id ? 'wait' : 'pointer',
                      }}
                    >
                      <i className="material-symbols-outlined" style={{ fontSize: '15px', animation: uploadingStoreId === pack.id ? 'spin 1s linear infinite' : 'none' }}>
                        {uploadingStoreId === pack.id ? 'autorenew' : 'share'}
                      </i>
                    </button>
                    {/* 삭제 */}
                    <LongPressButton
                      onLongPress={() => handleDeletePack(pack)}
                      onClick={() => alert('삭제하려면 휴지통 아이콘을 길게 누르세요.')}
                      title="길게 눌러서 삭제"
                      style={{
                        width: '30px', height: '30px',
                        borderRadius: '9px', border: '1px solid var(--line)',
                        background: 'var(--surface-container-lowest)', color: 'var(--ink-soft)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <i className="material-symbols-outlined" style={{ fontSize: '15px' }}>delete</i>
                    </LongPressButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
