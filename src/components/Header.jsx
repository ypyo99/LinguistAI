import { useEffect, useState } from 'react';

export default function Header() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      if (
        localStorage.getItem('color-theme') === 'dark' ||
        (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ) {
        document.documentElement.classList.add('dark');
        setIsDark(true);
      } else {
        document.documentElement.classList.remove('dark');
        setIsDark(false);
      }
    } catch (e) {
      // localStorage is blocked
      setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    try {
      if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('color-theme', 'light');
        setIsDark(false);
      } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('color-theme', 'dark');
        setIsDark(true);
      }
    } catch (e) {
      setIsDark(!isDark);
      document.documentElement.classList.toggle('dark');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-surface dark:bg-dark-surface border-b border-outline-variant dark:border-outline shadow-sm transition-all duration-200 ease-in-out">
      <div className="flex justify-between items-center w-full px-4 sm:px-6 md:px-xl max-w-[1200px] mx-auto h-14 sm:h-16">
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-sm">
          <span className="material-symbols-outlined text-xl sm:text-2xl text-primary dark:text-inverse-primary">
            translate
          </span>
          <span className="text-lg sm:text-headline-lg-mobile md:text-headline-lg font-bold text-primary dark:text-inverse-primary tracking-tight">
            LinguistAI
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 sm:gap-sm">
          <button
            className="touch-target w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant dark:text-on-dark-surface-variant hover:bg-surface-variant dark:hover:bg-dark-surface-bright transition-colors"
            id="theme-toggle"
            type="button"
            aria-label="테마 전환"
            onClick={toggleTheme}
          >
            {isDark ? (
              <span className="material-symbols-outlined text-xl">light_mode</span>
            ) : (
              <span className="material-symbols-outlined text-xl">dark_mode</span>
            )}
          </button>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden bg-surface-variant dark:bg-dark-surface-bright flex items-center justify-center">
            <span className="material-symbols-outlined text-base text-on-surface-variant dark:text-on-dark-surface-variant">
              person
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
