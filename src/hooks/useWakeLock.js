import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';

export function useWakeLock(isActive) {
  const wakeLockRef = useRef(null);

  useEffect(() => {
    const requestWakeLock = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.keepAwake();
        } catch (err) {
          console.warn(`Native KeepAwake error:`, err);
        }
      } else {
        try {
          if ('wakeLock' in navigator) {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
          }
        } catch (err) {
          console.warn(`Web Wake Lock error: ${err.name}, ${err.message}`);
        }
      }
    };

    const releaseWakeLock = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.allowSleep();
        } catch (err) {
          console.warn(`Native allowSleep error:`, err);
        }
      } else {
        if (wakeLockRef.current !== null) {
          try {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
          } catch (err) {
            console.warn(`Web Wake Lock release error: ${err.name}, ${err.message}`);
          }
        }
      }
    };

    if (isActive) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      // Re-request wake lock when page becomes visible again, as OS might release it
      if (!Capacitor.isNativePlatform() && isActive && document.visibilityState === 'visible' && wakeLockRef.current === null) {
        requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isActive]);
}
