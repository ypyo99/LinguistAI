export default function Footer() {
  return (
    <footer className="bg-surface-container-low dark:bg-dark-surface border-t border-outline-variant dark:border-outline mt-auto transition-colors duration-200">
      <div className="w-full py-6 sm:py-xl px-4 sm:px-lg flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-md max-w-[1200px] mx-auto text-center sm:text-left">
        <div className="text-sm sm:text-label-md font-bold text-on-surface dark:text-on-dark-surface opacity-80">
          LinguistAI
        </div>
        <div className="flex flex-wrap justify-center gap-4 sm:gap-md">
          {['개인정보 처리방침', '이용약관', '고객센터'].map(item => (
            <a
              key={item}
              className="text-xs sm:text-label-sm text-on-surface-variant dark:text-on-dark-surface-variant hover:text-primary dark:hover:text-inverse-primary transition-colors"
              href="#"
            >
              {item}
            </a>
          ))}
        </div>
        <div className="text-xs sm:text-label-sm text-primary dark:text-inverse-primary opacity-80">
          © 2026 LinguistAI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
