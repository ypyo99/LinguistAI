const TABS = [
  { id: 'study',  label: '학습',  icon: 'school' },
  { id: 'create', label: '생성',  icon: 'edit_document' },
  { id: 'setup',  label: '설정',  icon: 'settings' },
];

export default function TabNavigation({ activeTab, setActiveTab }) {
  return (
    <nav className="flex border-b border-outline-variant dark:border-outline mb-4 sm:mb-xl bg-surface-container-lowest dark:bg-dark-surface rounded-t-xl shadow-sm overflow-x-auto scrollbar-none transition-colors duration-200">
      {TABS.map(({ id, label, icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            className={`
              flex flex-col items-center gap-1 flex-1 min-w-[72px] py-3 sm:py-sm md:py-md
              border-b-2 text-xs sm:text-label-sm md:text-label-md font-medium
              transition-all duration-200 group whitespace-nowrap px-2
              ${isActive
                ? 'border-primary text-primary dark:border-inverse-primary dark:text-inverse-primary'
                : 'border-transparent text-on-surface-variant dark:text-on-dark-surface-variant hover:text-on-surface dark:hover:text-on-dark-surface hover:bg-surface-variant/30 dark:hover:bg-dark-surface-bright/30 rounded-t-lg'}
            `}
            onClick={() => setActiveTab(id)}
            aria-selected={isActive}
            role="tab"
          >
            <span className="material-symbols-outlined text-[22px] sm:text-[24px] md:text-[28px]">
              {icon}
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
