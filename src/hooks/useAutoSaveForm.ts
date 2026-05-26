import { useCallback, useEffect, useState } from 'react';

export function useAutoSaveForm<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;

    try {
      const saved = window.localStorage.getItem(key);
      return saved ? JSON.parse(saved) as T : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Evita quebrar o app caso o navegador bloqueie localStorage.
    }
  }, [key, value]);

  const clearSavedValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Evita quebrar o app caso o navegador bloqueie localStorage.
    }
    setValue(initialValue);
  }, [key, initialValue]);

  return [value, setValue, clearSavedValue] as const;
}
