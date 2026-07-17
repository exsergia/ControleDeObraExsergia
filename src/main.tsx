import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let refreshingForUpdate = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshingForUpdate) return;
      refreshingForUpdate = true;
      const reloadKey = 'exsergia-sw-refresh';
      if (sessionStorage.getItem(reloadKey) === 'done') return;
      sessionStorage.setItem(reloadKey, 'done');
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.update().catch(() => {});

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch((error) => {
      console.warn('Service Worker nao registrado:', error);
    });
  });
}
