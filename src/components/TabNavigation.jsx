const TABS = [
  { id: 'study', label: '학습', icon: 'headphones' },
  { id: 'library', label: '보관함', icon: 'inventory_2' },
  { id: 'store', label: '스토어', icon: 'storefront' },
  { id: 'create', label: '생성', icon: 'note_add' },
  { id: 'setup', label: '설정', icon: 'settings' }
];

export default function TabNavigation({ activeTab, setActiveTab, user }) {
  return (
    <div className="tabs">
      {TABS.filter(t => t.id !== 'store' || user).map(({ id, label, icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            className={`tab ${isActive ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
            aria-selected={isActive}
            role="tab"
          >
            <i className="material-symbols-outlined">{icon}</i>
            {label}
          </button>
        );
      })}
    </div>
  );
}
