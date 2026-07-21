import { supabase } from './supabase';
import { compressImage } from './imageUtils';
import { FiscalAiAnalysis } from '../types';

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
      const timeout = new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error('Service worker indisponivel')), 1500)
      );
      const reg = await Promise.race([navigator.serviceWorker.ready, timeout]);
      // Sem `icon` (ícone grande): no Android ele fica à direita e corta o texto do corpo.
      if ('showNotification' in reg) {
        await reg.showNotification(title, { body, badge: '/icon-192.png' });
        return;
      }
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

const UPLOADS_BUCKET = 'uploads';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

const buildAccessUrl = async (bucket: string, path: string) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) throw error;
  return data.signedUrl;
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
  const { error } = await supabase.storage.from(UPLOADS_BUCKET).upload(fileName, body, {
    cacheControl: '3600',
    upsert: false,
    contentType,
  });

  if (error) throw error;

  onProgress?.(100);
  return buildAccessUrl(UPLOADS_BUCKET, fileName);
};

export const uploadFile = async (file: File, path = 'uploads', onProgress?: (progress: number) => void): Promise<string> => {
  const fileName = `${path}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
  onProgress?.(10);
  const { error } = await supabase.storage.from(UPLOADS_BUCKET).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  onProgress?.(100);
  return buildAccessUrl(UPLOADS_BUCKET, fileName);
};

export const uploadPhoto = uploadImage;

export async function analyzeFiscalImage(params: {
  imageUrl?: string;
  imageDataUrl?: string;
  tipo: 'NF' | 'Cupom';
  valor: number;
  data: string;
  despesa?: string;
}): Promise<FiscalAiAnalysis> {
  const pending = (message: string, detail?: string): FiscalAiAnalysis => ({
    status: 'pendente',
    confidence: 0,
    documentType: 'Indefinido',
    extractedValue: null,
    extractedDate: null,
    vendor: null,
    reasons: [message],
    warnings: detail ? [detail] : ['Documento salvo sem analise automatica.'],
    analyzedAt: new Date().toISOString(),
    configured: false,
    error: detail,
  });

  let result: Awaited<ReturnType<typeof supabase.functions.invoke>>;
  try {
    result = await Promise.race([
      supabase.functions.invoke('analyze-fiscal-image', { body: params }),
      new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error('Tempo limite da IA excedido.')), 30000)
      ),
    ]);
  } catch (err: any) {
    return pending('Nao foi possivel executar a analise automatica.', err?.message || 'Edge Function indisponivel.');
  }

  const { data, error } = result;
  if (error) {
    return pending('Nao foi possivel executar a analise automatica.', error.message || 'Edge Function indisponivel.');
  }

  if ((data as any)?.error) {
    return pending('A IA nao concluiu a leitura da imagem.', String((data as any).error));
  }

  return data as FiscalAiAnalysis;
}

function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Nao foi possivel ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

export async function scanFiscalImageFile(file: File, params: {
  tipo: 'NF' | 'Cupom';
  valor: number;
  data: string;
  despesa?: string;
}) {
  let imageForScan: Blob = file;
  try {
    imageForScan = await compressImage(file, 1200, 0.65);
  } catch {
    imageForScan = file;
  }
  const imageDataUrl = await fileToDataUrl(imageForScan);
  return analyzeFiscalImage({ ...params, imageDataUrl });
}
