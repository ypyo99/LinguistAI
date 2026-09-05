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

  return (
    <div className="tab-fade-in" style={{ paddingBottom: '40px' }}>
      <h2 className="section-heading" style={{ fontSize: '20px', marginBottom: '16px' }}>내 학습 데이터</h2>
      
      {savedPacks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-soft)', background: 'var(--surface-container-lowest)', borderRadius: '16px', border: '1px dashed var(--line)' }}>
          <i className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--amber)', marginBottom: '16px' }}>inventory_2</i>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6' }}>
            보관함에 저장된 학습 데이터가 없습니다.<br/>
            학습 탭에서 <strong>[보관함에 저장]</strong> 버튼을 눌러 데이터를 보관해 보세요.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {savedPacks.map(pack => (
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
                  onClick={() => handleDeletePack(pack.id)}
                  style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--surface-container-lowest)', color: 'var(--ink-soft)', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
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
