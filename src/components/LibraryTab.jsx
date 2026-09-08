export default function LibraryTab({ 
  savedPacks = [], 
  setSavedPacks, 
  setSentences, 
  setPackTitle, 
  setFavorites, 
  setStudiedIndices, 
  setActiveTab,
  setCurrentPackId
}) {
  const handleLoadPack = (pack) => {
    setSentences(pack.sentences || []);
    setPackTitle(pack.title || '');
    setFavorites(pack.favorites || []);
    setStudiedIndices(pack.studiedIndices || []);
    if (setCurrentPackId) setCurrentPackId(pack.id);
    setActiveTab('study');
  };

  const handleDeletePack = (id) => {
    if(confirm('이 저장된 데이터를 삭제하시겠습니까?')) {
      setSavedPacks(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleDownloadPack = (pack) => {
    try {
      // 다운로드 시 즐겨찾기(favorites) 데이터 제외
      const { favorites, ...packToDownload } = pack;
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(packToDownload, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", (pack.title || "학습데이터") + ".json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (e) {
      console.error("다운로드 실패:", e);
      alert("다운로드 중 오류가 발생했습니다.");
    }
  };

  // 보관함 정렬 로직: 기본 제목 가나다순 -> 초급/중급/고급 순 -> 최신순
  const sortedPacks = [...savedPacks].sort((a, b) => {
    const titleA = a.title || '';
    const titleB = b.title || '';
    
    // '초급', '중급', '고급' 텍스트를 제거하여 기본 제목 추출
    const baseA = titleA.replace(/초급|중급|고급/g, '').trim();
    const baseB = titleB.replace(/초급|중급|고급/g, '').trim();
    
    // 1. 기본 제목이 다르면 가나다순 정렬 (같은 제목끼리 묶이도록)
    const baseDiff = baseA.localeCompare(baseB);
    if (baseDiff !== 0) {
      return baseDiff;
    }
    
    // 2. 기본 제목이 같으면 초급(1) -> 중급(2) -> 고급(3) 순으로 정렬
    const getLevel = (t) => {
      if (t.includes('초급')) return 1;
      if (t.includes('중급')) return 2;
      if (t.includes('고급')) return 3;
      return 4; // 그 외
    };
    
    const levelDiff = getLevel(titleA) - getLevel(titleB);
    if (levelDiff !== 0) {
      return levelDiff;
    }
    
    // 3. 제목과 난이도가 모두 같으면 최신순(내림차순) 정렬
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div className="tab-fade-in" style={{ paddingBottom: '40px' }}>
      <h2 className="section-heading" style={{ fontSize: '20px', marginBottom: '16px' }}>내 학습 데이터</h2>
      
      {sortedPacks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-soft)', background: 'var(--surface-container-lowest)', borderRadius: '16px', border: '1px dashed var(--line)' }}>
          <i className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--amber)', marginBottom: '16px' }}>inventory_2</i>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6' }}>
            보관함에 저장된 학습 데이터가 없습니다.<br/>
            학습 탭에서 <strong>[보관함에 저장]</strong> 버튼을 눌러 데이터를 보관해 보세요.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sortedPacks.map(pack => (
            <div key={pack.id} style={{ background: 'var(--surface)', border: '0.5px solid var(--line)', padding: '16px 20px', borderRadius: '16px', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pack.title}</h3>
                <p style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: 'var(--ink-soft)', margin: '4px 0 0 0' }}>
                  {new Date(pack.createdAt).toLocaleDateString()}
                  <i className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--amber)', marginLeft: '8px', marginRight: '4px' }}>star</i>
                  {pack.favorites?.length || 0}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button 
                  onClick={() => handleLoadPack(pack)}
                  className="btn-orange"
                  style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', background: 'var(--teal)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <i className="material-symbols-outlined" style={{ fontSize: '18px' }}>play_arrow</i>
                </button>
                <button 
                  onClick={() => handleDownloadPack(pack)}
                  style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--surface-container-lowest)', color: 'var(--ink-soft)', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                  title="다운로드"
                >
                  <i className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</i>
                </button>
                <button 
                  onClick={() => handleDeletePack(pack.id)}
                  style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--surface-container-lowest)', color: 'var(--ink-soft)', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                  title="삭제"
                >
                  <i className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
