import { useState } from 'react';

export function usePersistedTab<T extends string>(key: string, defaultValue: T): [T, (tab: T) => void] {
  const [activeTab, setActiveTabState] = useState<T>(
    () => (localStorage.getItem(key) as T) || defaultValue
  );

  const setActiveTab = (tab: T) => {
    localStorage.setItem(key, tab);
    setActiveTabState(tab);
  };

  return [activeTab, setActiveTab];
}
