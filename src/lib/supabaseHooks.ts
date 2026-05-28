import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { CollectionRef, getDocs } from './supabaseDb';

/**
 * Hook de leitura com Realtime.
 * @param paused Quando true, congela atualizações do Realtime (use quando um modal
 *               crítico está aberto, ex: captura de foto no mobile).
 */
export function useCollection(
  ref: CollectionRef | null | undefined,
  paused = false
): [any | undefined, boolean, Error | undefined] {
  const [snap, setSnap] = useState<any>();
  const [loading, setLoading] = useState(!!ref);
  const [error, setError] = useState<Error>();

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const pausedRef = useRef(paused);

  // Mantém pausedRef sempre sincronizado sem re-criar loadData
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const refKey = useMemo(() => JSON.stringify(ref || null), [ref]);

  const loadData = useCallback(async (isInitial: boolean) => {
    if (!ref) {
      setSnap(undefined);
      setLoading(false);
      return;
    }

    // Se pausado e não é carga inicial, descarta silenciosamente
    if (!isInitial && pausedRef.current) return;

    // Evita fetches concorrentes em background
    if (!isInitial && isFetchingRef.current) return;

    isFetchingRef.current = true;

    // Spinner apenas na primeira carga da query
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
      if (isInitial) setLoading(false);
    }
  }, [refKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carga inicial — dispara quando a query muda
  useEffect(() => {
    let alive = true;
    hasLoadedRef.current = false;

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

  // Cancela updates pendentes quando o app vai para background (câmera, troca de app, etc.)
  // Isso evita que o Realtime dispare re-renders quando o iOS retorna ao browser.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Realtime — atualiza silenciosamente; respeitando a flag paused
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
          refreshTimer.current = setTimeout(() => {
            // Se ainda pausado quando o timer disparar, agenda para depois do unpause
            if (pausedRef.current) {
              const waitForUnpause = setInterval(() => {
                if (!pausedRef.current) {
                  clearInterval(waitForUnpause);
                  loadData(false);
                }
              }, 300);
              // Timeout de segurança para não ficar aguardando para sempre
              setTimeout(() => clearInterval(waitForUnpause), 30000);
              return;
            }
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
