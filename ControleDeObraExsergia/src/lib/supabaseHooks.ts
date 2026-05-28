import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { CollectionRef, getDocs, LOCAL_DB_CHANGE_EVENT } from './supabaseDb';

/**
 * Cache em memória compartilhado entre todos os componentes que usam useCollection.
 * Sobrevive a desmontes/remontes de rota — ao voltar para uma tela já visitada,
 * os dados aparecem instantaneamente do cache, sem tela branca de loading.
 *
 * O cache é refrescado em background quando há mudanças (eventos locais ou
 * Realtime do Supabase), sem disparar estado de loading visível.
 */
type CacheEntry = {
  snap: any;
  timestamp: number;
  // Listeners para propagar atualizações entre componentes que usam a mesma query.
  subscribers: Set<(snap: any) => void>;
};

const globalCache = new Map<string, CacheEntry>();

// Tempo máximo em que consideramos o cache "fresco". Acima disso, refazemos
// a leitura em background ao montar (sem mostrar loading se já temos dado).
const CACHE_STALE_MS = 30 * 1000;

function getCacheEntry(key: string): CacheEntry {
  let entry = globalCache.get(key);
  if (!entry) {
    entry = { snap: undefined, timestamp: 0, subscribers: new Set() };
    globalCache.set(key, entry);
  }
  return entry;
}

function notifySubscribers(key: string, snap: any) {
  const entry = globalCache.get(key);
  if (!entry) return;
  entry.snap = snap;
  entry.timestamp = Date.now();
  entry.subscribers.forEach((cb) => cb(snap));
}

export function useCollection(ref: CollectionRef | null | undefined): [any | undefined, boolean, Error | undefined] {
  const refKey = useMemo(() => JSON.stringify(ref || null), [ref]);

  // Inicializa o snap a partir do cache global (se houver) — evita flash de loading.
  const [snap, setSnap] = useState<any>(() => {
    if (!ref) return undefined;
    const entry = globalCache.get(refKey);
    return entry?.snap;
  });

  // Loading só fica true se ainda não temos NADA do cache.
  const [loading, setLoading] = useState(() => {
    if (!ref) return false;
    const entry = globalCache.get(refKey);
    return !entry?.snap;
  });

  const [error, setError] = useState<Error>();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const loadData = useCallback(async (showLoading = false) => {
    const requestId = ++requestIdRef.current;
    if (!ref) {
      setSnap(undefined);
      setLoading(false);
      return;
    }

    try {
      // Só mostra loading se forçado E ainda não temos dado nenhum.
      const entry = getCacheEntry(refKey);
      if (showLoading && !entry.snap) setLoading(true);
      setError(undefined);

      const result = await getDocs(ref);
      if (requestId !== requestIdRef.current || !isMountedRef.current) return;

      // Propaga para todos os componentes que usam essa mesma query.
      notifySubscribers(refKey, result);
      setSnap(result);
    } catch (err) {
      if (requestId !== requestIdRef.current || !isMountedRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (requestId === requestIdRef.current && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [refKey]);

  // Inscreve-se no cache para receber updates de outros componentes que usam a mesma query.
  useEffect(() => {
    isMountedRef.current = true;
    if (!ref) return;

    const entry = getCacheEntry(refKey);
    const subscriber = (newSnap: any) => {
      if (isMountedRef.current) setSnap(newSnap);
    };
    entry.subscribers.add(subscriber);

    // Se já temos dado no cache, exibimos imediatamente.
    if (entry.snap) {
      setSnap(entry.snap);
      setLoading(false);

      // Se está velho, refresca em BACKGROUND (sem mostrar loading).
      if (Date.now() - entry.timestamp > CACHE_STALE_MS) {
        loadData(false);
      }
    } else {
      // Primeira carga real — pode mostrar loading.
      loadData(true);
    }

    return () => {
      isMountedRef.current = false;
      entry.subscribers.delete(subscriber);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [refKey, loadData]);

  // Listener de eventos locais (escritas na própria aba) e Realtime do Supabase.
  useEffect(() => {
    if (!ref?.table) return;

    const refreshSoon = (delay = 250) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        loadData(false); // background refresh — sem flash de loading
      }, delay);
    };

    const handleLocalChange = (event: Event) => {
      const detail = (event as CustomEvent<{ table?: string }>).detail;
      if (detail?.table === ref.table) refreshSoon(0);
    };

    window.addEventListener(LOCAL_DB_CHANGE_EVENT, handleLocalChange);

    // Debounce maior no Realtime (de 120ms para 800ms) para evitar refetches
    // em rajada quando há várias mudanças remotas seguidas.
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
        () => refreshSoon(800)
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

// Helper opcional: invalidar cache manualmente (útil para botão "atualizar").
export function invalidateCollectionCache(table?: string) {
  if (!table) {
    globalCache.clear();
    return;
  }
  for (const [key, entry] of globalCache.entries()) {
    try {
      const parsed = JSON.parse(key);
      if (parsed?.table === table) {
        entry.timestamp = 0; // marca como velho — próximo load forçará refresh
      }
    } catch {
      // ignora chaves malformadas
    }
  }
}
