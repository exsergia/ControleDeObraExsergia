import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { CollectionRef, getDocs, LOCAL_DB_CHANGE_EVENT } from './supabaseDb';

/**
 * Leitura padrao com atualizacao imediata local e Realtime do Supabase.
 * Escritas feitas nesta aba disparam um evento local; alteracoes de outras
 * abas/dispositivos chegam pelo canal postgres_changes.
 */
export function useCollection(ref: CollectionRef | null | undefined): [any | undefined, boolean, Error | undefined] {
  const [snap, setSnap] = useState<any>();
  const [loading, setLoading] = useState(!!ref);
  const [error, setError] = useState<Error>();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const refKey = useMemo(() => JSON.stringify(ref || null), [ref]);

  const loadData = useCallback(async (showLoading = false) => {
    const requestId = ++requestIdRef.current;

    if (!ref) {
      setSnap(undefined);
      setLoading(false);
      return;
    }

    try {
      if (showLoading || !hasLoadedRef.current) setLoading(true);
      setError(undefined);
      const result = await getDocs(ref);
      if (requestId !== requestIdRef.current) return;
      setSnap(result);
      hasLoadedRef.current = true;
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [refKey]);

  useEffect(() => {
    hasLoadedRef.current = false;
    loadData(true);

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [loadData]);

  useEffect(() => {
    if (!ref?.table) return;

    const refreshSoon = (delay = 80) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        loadData(false);
      }, delay);
    };

    const handleLocalChange = (event: Event) => {
      const detail = (event as CustomEvent<{ table?: string }>).detail;
      if (detail?.table === ref.table) refreshSoon(0);
    };

    window.addEventListener(LOCAL_DB_CHANGE_EVENT, handleLocalChange);

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
        () => refreshSoon(120)
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      window.removeEventListener(LOCAL_DB_CHANGE_EVENT, handleLocalChange);
      supabase.removeChannel(channel);
    };
  }, [ref?.table, loadData]);

  return [snap, loading, error];
}
