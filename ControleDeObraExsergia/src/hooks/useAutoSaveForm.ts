import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Salva o estado de um formulário no localStorage automaticamente.
 *
 * Diferenciais desta versão:
 * - Salvamento imediato (sincrono) também antes de unload / mudança de visibilidade
 *   (sair do app no celular, trocar de aba, fechar navegador).
 * - Preserva rascunho quando o componente desmonta (mudança de rota).
 * - Não bloqueia se localStorage estiver indisponível.
 */
export function useAutoSaveForm<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const saved = window.localStorage.getItem(key);
      return saved ? (JSON.parse(saved) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Ref espelha o estado atual para uso em listeners do window.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Helper interno para gravar agora.
  const saveNow = useCallback(
    (v: T) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {
        // ignora bloqueios de localStorage
      }
    },
    [key]
  );

  // Salva a cada mudança de valor.
  useEffect(() => {
    saveNow(value);
  }, [value, saveNow]);

  // Salva também em momentos críticos no mobile:
  // - pagehide: usuário fecha a aba/app
  // - visibilitychange para 'hidden': app vai para background no celular
  // - beforeunload: navegador fechando
  // Esses eventos são síncronos: não dá pra fazer await, mas localStorage.setItem
  // é sincrono e rápido, então funciona.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFlush = () => saveNow(valueRef.current);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') saveNow(valueRef.current);
    };

    window.addEventListener('pagehide', handleFlush);
    window.addEventListener('beforeunload', handleFlush);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      // Ao desmontar (mudança de rota), grava o estado atual antes de sair.
      saveNow(valueRef.current);
      window.removeEventListener('pagehide', handleFlush);
      window.removeEventListener('beforeunload', handleFlush);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [saveNow]);

  const clearSavedValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignora
    }
    setValue(initialValue);
  }, [key, initialValue]);

  return [value, setValue, clearSavedValue] as const;
}
