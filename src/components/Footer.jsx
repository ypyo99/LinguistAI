export default function Footer() {
  return (
    <footer style={{ marginTop: 'auto', borderTop: '0.5px solid var(--line)', background: 'var(--bg)' }}>
      <div className="w-full py-6 px-4 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-5 max-w-[1200px] mx-auto text-center md:text-left flex-wrap">
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--ink)', opacity: 0.8 }}>
          LinguistAI
        </div>
        <div className="flex flex-row flex-wrap justify-center gap-4 md:gap-5">
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
