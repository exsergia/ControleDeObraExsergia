import { supabase } from './supabase';
import { compressImage } from './imageUtils';

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

export const sendBrowserNotification = async (title: string, body: string) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // No mobile (e em PWAs) o construtor `new Notification()` é ilegal — é preciso
  // usar a Service Worker Registration. Tentamos esse caminho primeiro e só caímos
  // no construtor (desktop) como fallback. Tudo protegido para nunca lançar.
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      // Sem `icon` (ícone grande): no Android ele fica à direita e corta o texto do corpo.
      await reg.showNotification(title, { body, badge: '/icon-192.png' });
      return;
    }
  } catch {
    // ignora e tenta o fallback abaixo
  }

  try {
    new Notification(title, { body });
  } catch {
    // Ambiente não suporta o construtor (ex.: mobile sem SW pronto) — silencia.
  }
};

const buildPublicUrl = (bucket: string, path: string) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

export const uploadImage = async (file: File, path = 'uploads', onProgress?: (progress: number) => void): Promise<string> => {
  // Comprime imagens antes do upload (reduz tempo no 4G de campo e storage).
  // Se a compressão falhar, sobe o arquivo original — sem regressão.
  let body: Blob = file;
  let safeExt = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  let contentType = file.type || 'image/jpeg';

  if ((file.type || '').startsWith('image/')) {
    try {
      body = await compressImage(file, 1600, 0.7);
      safeExt = 'jpg';
      contentType = 'image/jpeg';
    } catch {
      body = file;
    }
  }

  const fileName = `${path}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

  onProgress?.(10);
  const { error } = await supabase.storage.from('uploads').upload(fileName, body, {
    cacheControl: '3600',
    upsert: false,
    contentType,
  });

  if (error) throw error;

  onProgress?.(100);
  return supabase.storage.from('uploads').getPublicUrl(fileName).data.publicUrl;
};

export const uploadFile = async (file: File, path = 'uploads', onProgress?: (progress: number) => void): Promise<string> => {
  const fileName = `${path}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
  onProgress?.(10);
  const { error } = await supabase.storage.from('uploads').upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  onProgress?.(100);
  return buildPublicUrl('uploads', fileName);
};

export const uploadPhoto = uploadImage;
