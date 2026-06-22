import { supabase } from './supabase';

// Chave VAPID pública (pode ser pública — identifica o servidor de push).
export const VAPID_PUBLIC_KEY = 'BKypXGMIjVO2r_XesWUjok4ZXIHlN6VhCCgT7NuSWA5xOgp_0vY1Ql4svCUb1RmlMAi54-D5zoi18o5PH-S97es';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Garante que o dispositivo do usuário esteja inscrito para receber Web Push.
 * Idempotente: pode ser chamada toda vez que o usuário entra no app.
 * Retorna true se a inscrição está ativa e salva.
 */
export async function registerPushForUser(userId: string): Promise<boolean> {
  try {
    if (!userId) return false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'denied') return false;
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON();
    await supabase.from('push_subscriptions').upsert({
      id: sub.endpoint,
      data: {
        userId,
        endpoint: sub.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
        updatedAt: new Date().toISOString(),
      },
    });

    return true;
  } catch (e) {
    console.warn('Falha ao registrar push:', e);
    return false;
  }
}
