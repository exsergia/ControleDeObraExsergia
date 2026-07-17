import { useState } from 'react';

export function usePersistedTab<T extends string>(key: string, defaultValue: T): [T, (tab: T) => void] {
  const [activeTab, setActiveTabState] = useState<T>(
    () => {
      try {
        return (localStorage.getItem(key) as T) || defaultValue;
      } catch {
        return defaultValue;
      }
    }
  );

  const setActiveTab = (tab: T) => {
    try {
      localStorage.setItem(key, tab);
    } catch {
      // Safari/iPhone em modo privado pode bloquear storage.
    }
    setActiveTabState(tab);
  };

  return [activeTab, setActiveTab];
}
