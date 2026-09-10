let isAlerting = false;

export function showAuthAlert(reason, setUser) {
  if (setUser) setUser(null);
  
  if (!isAlerting) {
    isAlerting = true;
    const msg = reason === 'SCOPE_INSUFFICIENT'
      ? '구글 드라이브 권한이 부족합니다.\n로그아웃 후 다시 로그인해 주세요.'
      : '구글 로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
    
    alert(msg);
    
    setTimeout(() => {
      isAlerting = false;
    }, 3000);
  }
}
