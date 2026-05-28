import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { CollectionRef, getDocs } from './supabaseDb';

export function useCollection(ref: CollectionRef | null | undefined): [any | undefined, boolean, Error | undefined] {
  const [snap, setSnap] = useState<any>();
  const [loading, setLoading] = useState(!!ref);
  const [error, setError] = useState<Error>();

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);
  const isFetchingRef = useRef(false);

  const refKey = useMemo(() => JSON.stringify(ref || null), [ref]);

  const loadData = useCallback(async (isInitial: boolean) => {
    if (!ref) {
      setSnap(undefined);
      setLoading(false);
      return;
    }

    // Ignora refreshes em background enquanto já há uma busca em andamento
    if (!isInitial && isFetchingRef.current) return;

    isFetchingRef.current = true;

    // Só mostra o spinner na carga inicial da query — nunca nos updates do Realtime
    if (isInitial && !hasLoadedRef.current) setLoading(true);

    try {
      setError(undefined);
      const result = await getDocs(ref);
      setSnap(result);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      isFetchingRef.current = false;
      // Remove o spinner apenas se foi a carga inicial que o ativou
      if (isInitial) setLoading(false);
    }
  }, [refKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carga inicial — dispara quando a query muda
  useEffect(() => {
    let alive = true;
    hasLoadedRef.current = false; // nova query = novo ciclo de loading

    const run = async () => {
      if (!alive) return;
      await loadData(true);
    };

    run();

    return () => {
      alive = false;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [loadData]);

  // Realtime — atualiza dados silenciosamente sem spinner
  useEffect(() => {
    if (!ref?.table) return;

    const channelName = `realtime-${ref.table}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: ref.table },
        () => {
          if (refreshTimer.current) clearTimeout(refreshTimer.current);
          // Debounce generoso: evita refetches em cascata quando múltiplas
          // tabelas são atualizadas na mesma operação (ex: checkout de ferramenta)
          refreshTimer.current = setTimeout(() => {
            loadData(false);
          }, 1200);
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
