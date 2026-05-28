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
  const safeExt = fileExt.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const fileName = `${path}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

  console.group('[SUPABASE_STORAGE_UPLOAD] Upload de imagem');
  console.log('Bucket:', 'uploads');
  console.log('Path:', fileName);
  console.log('Arquivo:', { name: file.name, type: file.type, size: file.size, lastModified: file.lastModified });

  onProgress?.(10);
  const uploadResponse = await supabase.storage.from('uploads').upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  });

  console.log('UPLOAD RESPONSE:', uploadResponse);

  if (uploadResponse.error) {
    console.error('UPLOAD ERROR:', uploadResponse.error);
    console.groupEnd();
    throw uploadResponse.error;
  }

  onProgress?.(100);
  const publicUrlResponse = supabase.storage.from('uploads').getPublicUrl(fileName);
  console.log('PUBLIC URL RESPONSE:', publicUrlResponse);
  console.groupEnd();
  return publicUrlResponse.data.publicUrl;
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
