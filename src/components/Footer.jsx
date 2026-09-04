export default function Footer() {
  return (
    <footer style={{ marginTop: 'auto', borderTop: '0.5px solid var(--line)', background: 'var(--bg)' }}>
      <style>{`.footer-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div className="w-full py-4 sm:py-xl px-4 sm:px-lg flex flex-row justify-between items-center gap-5 sm:gap-md max-w-[1200px] mx-auto text-left overflow-x-auto whitespace-nowrap footer-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--ink)', opacity: 0.8, flexShrink: 0 }}>
          LinguistAI
        </div>
        <div className="flex flex-row justify-center gap-4 sm:gap-md flex-shrink-0">
          {['개인정보 처리방침', '이용약관', '고객센터'].map(item => (
            <a
              key={item}
              style={{ fontSize: '13px', color: 'var(--ink-soft)', textDecoration: 'none' }}
              href="#"
            >
              {item}
            </a>
          ))}
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--teal-deep)', opacity: 0.8, flexShrink: 0 }}>
          © 2026 LinguistAI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
