export default function Footer() {
  return (
    <footer style={{ marginTop: 'auto', borderTop: '0.5px solid var(--line)', background: 'var(--bg)' }}>
      <div className="w-full py-2 px-4 flex flex-col md:flex-row justify-between items-center gap-1 md:gap-2 max-w-[1200px] mx-auto text-center md:text-left flex-wrap">
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--ink)', opacity: 0.8 }}>
          LinguistAI
        </div>

        <div style={{ fontSize: '12.5px', color: 'var(--teal-deep)', opacity: 0.8 }}>
          © 2026 LinguistAI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
