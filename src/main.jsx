import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { GoogleOAuthProvider } from '@react-oauth/google';

// TODO: 발급받은 실제 Google Client ID로 변경해야 합니다.
const GOOGLE_CLIENT_ID = "686267885768-dbfrdhospkatu04hvsc5mbu5n6gnjapd.apps.googleusercontent.com";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
