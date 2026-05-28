import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { CollectionRef, getDocs } from './supabaseDb';

// ─────────────────────────────────────────────────────────────────────────────
// Flag de visibilidade — nível de módulo (singleton).
//
// Quando o app vai para background (troca de app, bloqueio de tela, etc.),
// wasHiddenSinceLastLoad é setado para true.
// Enquanto true, NENHUMA atualização automática (Realtime) é processada.
// Só é zerada quando o usuário NAVEGA para outra página — o que remonta os
// componentes e dispara a carga inicial normalmente.
//
// Resultado: trocar de app nunca atualiza nada. Só navegar dentro do app
// busca dados novos. Funciona em web, Android e iOS.
// ─────────────────────────────────────────────────────────────────────────────
let wasHiddenSinceLastLoad = false;

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) wasHiddenSinceLastLoad = true;
  });
}

/**
 * Hook de leitura com Supabase Realtime.
 *
 * @param paused Quando true, congela atualizações do Realtime (use quando um
 *               modal crítico está aberto — ex: captura de foto no mobile).
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

  // Mantém pausedRef sincronizado sem recriar loadData
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

    // Realtime ignorado se: modal aberto OU página em/voltando de background
    if (!isInitial && pausedRef.current) return;
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

  // ── Carga inicial ─────────────────────────────────────────────────────────
  // Roda quando a query muda — na prática, quando o usuário navega para outra
  // página (componente remonta). Aqui é onde wasHiddenSinceLastLoad é zerado:
  // se o usuário navegou, ele está ativamente usando o app e queremos dados
  // frescos. Fora daqui, a flag permanece true bloqueando o Realtime.
  useEffect(() => {
    let alive = true;
    hasLoadedRef.current = false;

    // Navegação = nova página = libera atualizações para esta sessão de uso
    wasHiddenSinceLastLoad = false;

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

  // ── Realtime ──────────────────────────────────────────────────────────────
  // Processa mudanças do banco APENAS quando:
  //   1. A página está visível (não em background)
  //   2. A página NÃO foi para background desde o último carregamento
  //   3. Nenhum modal crítico está aberto (paused=false)
  useEffect(() => {
    if (!ref?.table) return;

    const channelName = `realtime-${ref.table}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: ref.table },
        () => {
          // Bloqueia se: modal aberto, página oculta, ou retornando de background
          if (pausedRef.current || document.hidden || wasHiddenSinceLastLoad) return;

          if (refreshTimer.current) clearTimeout(refreshTimer.current);
          refreshTimer.current = setTimeout(() => {
            // Verifica novamente quando o timer dispara (pode ter mudado)
            if (pausedRef.current || document.hidden || wasHiddenSinceLastLoad) return;
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
