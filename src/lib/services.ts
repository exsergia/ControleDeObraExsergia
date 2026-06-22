import { supabase } from './supabase';

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
      await reg.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png' });
      return;
    }
  } catch {
    // ignora e tenta o fallback abaixo
  }

  try {
    new Notification(title, { body, icon: '/icon-192.png' });
  } catch {
    // Ambiente não suporta o construtor (ex.: mobile sem SW pronto) — silencia.
  }
};

const buildPublicUrl = (bucket: string, path: string) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

export const uploadImage = async (file: File, path = 'uploads', onProgress?: (progress: number) => void): Promise<string> => {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const safeExt = fileExt.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const fileName = `${path}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

  onProgress?.(10);
  const { error } = await supabase.storage.from('uploads').upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
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
