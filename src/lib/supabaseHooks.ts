import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { CollectionRef, getDocs } from './supabaseDb';

/**
 * Hook padrão de leitura com atualização em tempo real pelo Supabase Realtime.
 * Sempre que houver INSERT, UPDATE ou DELETE na tabela usada pela tela,
 * os dados são buscados novamente automaticamente, sem precisar apertar F5.
 */
export function useCollection(ref: CollectionRef | null | undefined): [any | undefined, boolean, Error | undefined] {
  const [snap, setSnap] = useState<any>();
  const [loading, setLoading] = useState(!!ref);
  const [error, setError] = useState<Error>();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);

  const refKey = useMemo(() => JSON.stringify(ref || null), [ref]);

  const loadData = useCallback(async (showLoading = false) => {
    if (!ref) {
      setSnap(undefined);
      setLoading(false);
      return;
    }

    try {
      if (showLoading || !hasLoadedRef.current) setLoading(true);
      setError(undefined);
      const result = await getDocs(ref);
      setSnap(result);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [refKey]);

  useEffect(() => {
    let alive = true;

    const safeLoad = async () => {
      if (!alive) return;
      await loadData(true);
    };

    safeLoad();

    return () => {
      alive = false;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [loadData]);

  useEffect(() => {
    if (!ref?.table) return;

    const channelName = `realtime-${ref.table}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: ref.table,
        },
        () => {
          // Debounce simples para evitar várias consultas seguidas quando muitos dados chegam juntos.
          if (refreshTimer.current) clearTimeout(refreshTimer.current);
          refreshTimer.current = setTimeout(() => {
            loadData(false);
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [ref?.table, loadData]);

  return [snap, loading, error];
}
