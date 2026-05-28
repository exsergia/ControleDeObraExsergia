import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Registro do Service Worker.
// updateViaCache: 'none' garante que o navegador sempre busca a versão mais
// recente do sw.js quando o usuário sai e volta. Mas o SW em si não força
// atualização da aba atual (não chama skipWaiting/clients.claim).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .catch((error) => {
        console.warn('Service Worker nao registrado:', error);
      });
  });
}
