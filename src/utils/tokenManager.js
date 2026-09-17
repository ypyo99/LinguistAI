/**
 * tokenManager.js
 * 웹(브라우저) 환경에서 Google 액세스 토큰을 자동으로 갱신합니다.
 *
 * Google Identity Services(GIS) implicit flow 토큰은 최대 1시간 유효합니다.
 * 이 모듈은 silent refresh를 통해 만료 전에 토큰을 자동 갱신합니다.
 */

const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45분 (토큰 1시간 수명 기준)

let _silentRefreshCallback = null; // Header에서 등록할 silent refresh 함수
let _refreshTimer = null;

/**
 * Header 컴포넌트에서 silent refresh를 수행할 콜백을 등록합니다.
 * @param {Function|null} callback - 새 액세스 토큰을 반환하는 async 함수 (null 시 등록 해제)
 */
export function registerSilentRefresh(callback) {
  _silentRefreshCallback = callback;
}

/**
 * 즉시 silent refresh를 시도합니다.
 * 성공 시 새 액세스 토큰을 반환합니다.
 * @returns {Promise<string|null>}
 */
export async function doSilentRefresh() {
  if (typeof _silentRefreshCallback === 'function') {
    try {
      const newToken = await _silentRefreshCallback();
      return newToken;
    } catch (err) {
      console.warn('[TokenManager] Silent refresh 실패:', err);
      return null;
    }
  }
  return null;
}

/**
 * 주기적 자동 갱신을 시작합니다.
 * 앱이 마운트될 때 한 번 호출하면 됩니다.
 */
export function startAutoRefresh() {
  stopAutoRefresh(); // 중복 방지

  _refreshTimer = setInterval(async () => {
    console.log('[TokenManager] 주기적 토큰 갱신 시도...');
    const newToken = await doSilentRefresh();
    if (newToken) {
      console.log('[TokenManager] 토큰 갱신 성공');
      window.dispatchEvent(new CustomEvent('token_refreshed', { detail: newToken }));
    } else {
      console.warn('[TokenManager] 토큰 갱신 실패 — 사용자 재로그인 필요할 수 있음');
    }
  }, REFRESH_INTERVAL_MS);
}

/**
 * 주기적 자동 갱신을 중지합니다.
 */
export function stopAutoRefresh() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
}
