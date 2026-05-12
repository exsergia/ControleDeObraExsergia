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

export const sendBrowserNotification = (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
};

const buildPublicUrl = (bucket: string, path: string) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

export const uploadImage = async (file: File, path = 'uploads', onProgress?: (progress: number) => void): Promise<string> => {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${path}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  onProgress?.(10);
  const { error } = await supabase.storage.from('uploads').upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  onProgress?.(100);
  return buildPublicUrl('uploads', fileName);
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
