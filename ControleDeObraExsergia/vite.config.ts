import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Target moderno reduz polyfills e gera bundle menor (mobile recente cobre).
      target: 'es2020',
      // Minificação padrão do Vite (esbuild) já é rápida e eficiente.
      minify: 'esbuild',
      // CSS minificado.
      cssMinify: true,
      // Não gera sourcemaps em produção (reduz bundle).
      sourcemap: false,
      // Aumenta o limite antes de warning, sem mudar comportamento.
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          // Chunks separados por biblioteca pesada. xlsx e qrcode ficam isolados
          // porque só são usados em telas específicas — quem nunca abre essas
          // telas nem baixa esses chunks.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
            charts: ['recharts'],
            xlsx: ['xlsx'],
            qrcode: ['html5-qrcode'],
            motion: ['motion'],
            icons: ['lucide-react'],
            dateutils: ['date-fns'],
          },
        },
      },
    },
    esbuild: {
      // Remove console.* e debugger em produção. Reduz bundle e ruído.
      // Mantém console.error e console.warn para diagnóstico.
      drop: mode === 'production' ? ['debugger'] : [],
      pure: mode === 'production' ? ['console.log', 'console.info', 'console.debug', 'console.group', 'console.groupEnd'] : [],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
