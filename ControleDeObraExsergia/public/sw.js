// Service Worker do Controle de Obra Exsergia
// Estratégia: cache-first para assets estáticos, network-only para API.
// Não usa skipWaiting/clients.claim para não derrubar abas com formulários abertos.
// Atualização só acontece quando o usuário sai TOTALMENTE do app e volta.

const CACHE_VERSION = 'exsergia-v5-cache-estavel';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Assets essenciais. O index.html não é cacheado para que o usuário sempre
// receba a versão mais recente quando reabre o app totalmente.
const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  // NÃO chama skipWaiting. Isso garante que a versão nova do SW só toma o
  // controle depois que todas as abas/instâncias do app forem fechadas.
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
  );
});

self.addEventListener('activate', (event) => {
  // Remove caches antigos de versões anteriores, mas só durante a ativação
  // (que só acontece quando o usuário fecha tudo).
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith('exsergia-') && !name.startsWith(CACHE_VERSION))
          .map((name) => caches.delete(name))
      )
    )
  );
  // NÃO chama clients.claim. A aba atual continua com o SW antigo até ser
  // fechada e reaberta. Isso preserva qualquer formulário/estado aberto.
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Nunca interceptar chamadas da API do Supabase nem do storage.
  // Essas chamadas precisam ir sempre direto para a rede.
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.in') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/storage/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/realtime/')
  ) {
    return;
  }

  // Para o index.html (navegação), tenta a rede primeiro. Se falhar (offline),
  // serve do cache. Isso evita "tela presa em versão antiga" quando online.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy).catch(() => undefined));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Para assets (JS, CSS, imagens, fontes): cache-first.
  // Se já temos em cache, devolve imediato (super rápido, sem rede).
  // Se não, busca da rede e armazena para próxima vez.
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy).catch(() => undefined));
          }
          return response;
        });
      })
    );
    return;
  }

  // Fallback: deixa a rede lidar normalmente.
});

// Mensagem opcional para forçar atualização explícita do SW pelo app
// (ex: botão "verificar atualizações" nas configurações).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
