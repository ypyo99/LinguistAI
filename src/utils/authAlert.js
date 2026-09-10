let lastAlertTime = 0;

export function showAuthAlert(reason, setUser) {
  if (setUser) setUser(null);
  
  if (Date.now() - lastAlertTime < 3000) {
    return;
  }
  
  const msg = reason === 'SCOPE_INSUFFICIENT'
    ? '구글 드라이브 권한이 부족합니다.\n로그아웃 후 다시 로그인해 주세요.'
    : '구글 로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  
  alert(msg);
  
  lastAlertTime = Date.now();
}
