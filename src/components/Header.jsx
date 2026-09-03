import { useEffect, useState } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { useGoogleLogin } from '@react-oauth/google';

export default function Header({ title = "병원 진료 표현 20개", sub = "오늘의 회화 연습", total = 20, progress = 0 }) {
  const [isDark, setIsDark] = useState(false);
  
  // 구글 사용자 상태 관리 (기본값 null)
  const [user, setUser] = usePersistentState('linguist-user', null);
  const [showDropdown, setShowDropdown] = useState(false);

  // 구글 로그인 훅
  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const data = await res.json();
        // 받아온 실제 정보를 저장
        setUser({
          name: data.name || 'Google User',
          email: data.email || '',
          picture: data.picture || 'https://api.dicebear.com/7.x/avataaars/svg?seed=GoogleUser&backgroundColor=e5e7eb',
          accessToken: tokenResponse.access_token // 구글 드라이브 API 연동을 위해 토큰 저장
        });
      } catch (err) {
        console.error("Failed to fetch user info", err);
        alert("사용자 정보를 가져오는데 실패했습니다.");
      }
    },
    onError: (err) => {
      console.error("Google Login Failed", err);
      alert("구글 로그인에 실패했습니다. Client ID가 올바르게 설정되었는지 확인해주세요.");
    }
  });

  const handleUserClick = () => {
    if (!user) {
      login();
    } else {
      setShowDropdown(!showDropdown);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setShowDropdown(false);
  };

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

  const pct = total > 0 ? (progress / total) * 100 : 0;

  return (
    <div className="topbar">
      <div className="topbar-row">
        <div className="wordmark">
          <div className="brand-badge">
            <svg viewBox="0 0 32 32" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="13" cy="13" r="10" stroke="var(--amber)" strokeWidth="1.5" fill="var(--surface)"/>
              <ellipse cx="13" cy="13" rx="4.2" ry="10" stroke="var(--amber)" strokeWidth="1.1" fill="none"/>
              <line x1="3" y1="13" x2="23" y2="13" stroke="var(--amber)" strokeWidth="1.1"/>
              <path d="M4.3 8C7 9.6 19 9.6 21.7 8" stroke="var(--amber)" strokeWidth="1" fill="none"/>
              <path d="M4.3 18C7 16.4 19 16.4 21.7 18" stroke="var(--amber)" strokeWidth="1" fill="none"/>
              <path d="M23 15c3.87 0 7 3.13 7 7s-3.13 7-7 7c-.98 0-1.9-.2-2.75-.56L16 31v-3.8C14.77 25.9 14 23.9 14 22c0-3.87 3.13-7 7-7z" fill="currentColor" stroke="none"/>
              <circle cx="19.7" cy="22" r="1" fill="var(--surface)" stroke="none"/>
              <circle cx="23" cy="22" r="1" fill="var(--surface)" stroke="none"/>
              <circle cx="26.3" cy="22" r="1" fill="var(--surface)" stroke="none"/>
            </svg>
          </div>
          LinguistAI
        </div>
        <div className="topbar-actions" style={{ position: 'relative' }}>
          <button className="icon-btn" onClick={toggleTheme}>
            <i className="material-symbols-outlined" style={{ fontSize: '20px' }}>{isDark ? "light_mode" : "dark_mode"}</i>
          </button>
          
          <button className={user ? "user-avatar" : "icon-btn"} onClick={handleUserClick} style={{ padding: 0, overflow: 'hidden' }}>
            {user ? (
              <img src={user.picture} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <i className="material-symbols-outlined" style={{ fontSize: '20px' }}>person</i>
            )}
          </button>

          {showDropdown && user && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                <img src={user.picture} alt="avatar" className="user-dropdown-avatar" />
                <div className="user-dropdown-info">
                  <div className="user-dropdown-name">{user.name}</div>
                  <div className="user-dropdown-email">{user.email}</div>
                </div>
              </div>
              <button className="user-dropdown-btn" onClick={handleLogout}>
                <i className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</i>
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="topbar-sub">{sub}</div>
      <div className="topbar-title">{title}</div>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }}></div></div>
      <div className="progress-label">{progress} / {total} 문장 학습 완료</div>
    </div>
  );
}
