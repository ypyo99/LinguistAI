import { useState, useEffect } from 'react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      if (item !== null) {
        return JSON.parse(item);
      }
    } catch (e) {
      console.warn(`localStorage read error for key "${key}":`, e);
    }
    return initialValue;
  });

  // 파일시스템(영구 스토리지) 복원 로직
  useEffect(() => {
    if (key === 'linguist-saved-packs' && Capacitor.isNativePlatform()) {
      const loadFromFileSystem = async () => {
        try {
          const result = await Filesystem.readFile({
            path: `LinguistAI/${key}.json`,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
          });
          if (result.data) {
            const parsed = JSON.parse(result.data);
            // 로컬 스토리지 데이터보다 파일 데이터가 우선순위를 가집니다 (앱 삭제 후 재설치 시 복구)
            const local = localStorage.getItem(key);
            if (!local || local !== result.data) {
              setState(parsed);
              localStorage.setItem(key, result.data);
              window.dispatchEvent(new CustomEvent('linguist-storage-sync', { detail: { key, value: parsed } }));
            }
          }
        } catch (e) {
          console.log('No existing backup found in external storage or permission denied.', e);
        }
      };
      loadFromFileSystem();
    }
  }, [key]);

  // 저장 로직 (로컬 스토리지 + 파일시스템 이중 백업)
  useEffect(() => {
    try {
      const stringified = JSON.stringify(state);
      localStorage.setItem(key, stringified);
      
      // 파일시스템 백업
      if (key === 'linguist-saved-packs' && Capacitor.isNativePlatform()) {
        const saveToFileSystem = async () => {
          try {
            await Filesystem.writeFile({
              path: `LinguistAI/${key}.json`,
              data: stringified,
              directory: Directory.Documents,
              encoding: Encoding.UTF8,
              recursive: true
            });
          } catch (e) {
            console.error('Failed to backup to external storage:', e);
          }
        };
        saveToFileSystem();
      }

      // Broadcast change to other components in the same window
      window.dispatchEvent(new CustomEvent('linguist-storage-sync', { detail: { key, value: state } }));
    } catch (e) {
      console.warn(`localStorage write error for key "${key}":`, e);
    }
  }, [key, state]);

  useEffect(() => {
    const handleSync = (e) => {
      if (e.detail.key === key && JSON.stringify(e.detail.value) !== JSON.stringify(state)) {
        setState(e.detail.value);
      }
    };
    window.addEventListener('linguist-storage-sync', handleSync);
    return () => window.removeEventListener('linguist-storage-sync', handleSync);
  }, [key, state]);

  return [state, setState];
}
