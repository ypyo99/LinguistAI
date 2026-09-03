import { useState, useEffect } from 'react';

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

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
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
