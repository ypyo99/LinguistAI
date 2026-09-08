import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { GoogleOAuthProvider } from '@react-oauth/google';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';

// TODO: 발급받은 실제 Google Client ID로 변경해야 합니다.
const GOOGLE_CLIENT_ID = "686267885768-dbfrdhospkatu04hvsc5mbu5n6gnjapd.apps.googleusercontent.com";

// 앱이 완전히 켜졌음을 Updater에 알려 업데이트 무한 루프 롤백을 방지합니다.
if (Capacitor.isNativePlatform()) {
  CapacitorUpdater.notifyAppReady();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
