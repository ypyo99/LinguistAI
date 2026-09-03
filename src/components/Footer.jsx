export default function Footer() {
  return (
    <footer style={{ marginTop: 'auto', borderTop: '0.5px solid var(--line)', background: 'var(--bg)' }}>
      <div className="w-full py-6 sm:py-xl px-4 sm:px-lg flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-md max-w-[1200px] mx-auto text-center sm:text-left">
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--ink)', opacity: 0.8 }}>
          LinguistAI
        </div>
        <div className="flex flex-wrap justify-center gap-4 sm:gap-md">
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
        <div style={{ fontSize: '12.5px', color: 'var(--teal-deep)', opacity: 0.8 }}>
          © 2026 LinguistAI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
