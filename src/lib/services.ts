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

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export interface StorageUploadResult {
  bucket: string;
  path: string;
  url: string;
}

export const createSignedStorageUrl = async (bucket: string, path: string) => {
  const signedUrlResponse = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  console.log('SIGNED URL RESPONSE:', signedUrlResponse);

  if (signedUrlResponse.error || !signedUrlResponse.data?.signedUrl) {
    throw signedUrlResponse.error || new Error(`Não foi possível gerar URL assinada para ${bucket}/${path}.`);
  }

  return signedUrlResponse.data.signedUrl;
};

const uploadToStorage = async (
  file: File,
  path = 'uploads',
  onProgress?: (progress: number) => void,
  bucket = 'uploads'
): Promise<StorageUploadResult> => {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const safeExt = fileExt.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const fileName = `${path}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

  console.group('[SUPABASE_STORAGE_UPLOAD] Upload de arquivo');
  console.log('Bucket:', bucket);
  console.log('Path:', fileName);
  console.log('Arquivo:', { name: file.name, type: file.type, size: file.size, lastModified: file.lastModified });

  onProgress?.(10);
  const uploadResponse = await supabase.storage.from(bucket).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });

  console.log('UPLOAD RESPONSE:', uploadResponse);

  if (uploadResponse.error) {
    console.error('UPLOAD ERROR:', uploadResponse.error);
    console.groupEnd();
    throw uploadResponse.error;
  }

  onProgress?.(100);

  // Buckets privados não funcionam com getPublicUrl. Para o fluxo de ferramentas,
  // usamos createSignedUrl para acessar a imagem após o upload.
  const signedUrl = await createSignedStorageUrl(bucket, fileName);
  console.groupEnd();
  return {
    bucket,
    path: fileName,
    url: signedUrl,
  };
};

export const uploadImage = async (file: File, path = 'uploads', onProgress?: (progress: number) => void): Promise<string> => {
  return (await uploadToStorage(file, path, onProgress, 'uploads')).url;
};

export const uploadFile = async (file: File, path = 'uploads', onProgress?: (progress: number) => void): Promise<string> => {
  return (await uploadToStorage(file, path, onProgress, 'uploads')).url;
};

export const uploadPhoto = async (file: File, path = 'uploads', onProgress?: (progress: number) => void): Promise<string> => {
  return (await uploadToStorage(file, path, onProgress, 'ferramentas')).url;
};

export const uploadPhotoWithMetadata = async (
  file: File,
  path = 'uploads',
  onProgress?: (progress: number) => void
): Promise<StorageUploadResult> => {
  return uploadToStorage(file, path, onProgress, 'ferramentas');
};

export const checkCameraPermission = async (): Promise<boolean> => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Camera API não suportada neste dispositivo');
      return false;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Erro ao verificar permissão de câmera:', error);
    return false;
  }
};

export const requestCameraPermission = async (): Promise<boolean> => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Camera API não suportada neste dispositivo');
      return false;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Permissão de câmera negada ou erro ao solicitar:', error);
    return false;
  }
};
