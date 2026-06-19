import type { GeoPoint } from '../types';

/**
 * Captura a localização pontual do dispositivo no momento da chamada.
 *
 * É best-effort: se o usuário negar a permissão ou o GPS falhar, resolve com
 * `null` em vez de rejeitar, para não travar o fluxo de retirada/devolução.
 */
export const capturarLocalizacao = (timeoutMs = 12000): Promise<GeoPoint | null> => {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (value: GeoPoint | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => finish({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      () => finish(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );

    // Salvaguarda extra caso o callback de erro não dispare em algum dispositivo.
    setTimeout(() => finish(null), timeoutMs + 1000);
  });
};

/** Link para abrir a coordenada no Google Maps. */
export const mapsUrl = (ponto?: GeoPoint | null): string | null => {
  if (!ponto || typeof ponto.lat !== 'number' || typeof ponto.lng !== 'number') return null;
  return `https://www.google.com/maps?q=${ponto.lat},${ponto.lng}`;
};

/** Formata a coordenada para exibição curta. */
export const formatGeo = (ponto?: GeoPoint | null): string | null => {
  if (!ponto || typeof ponto.lat !== 'number' || typeof ponto.lng !== 'number') return null;
  return `${ponto.lat.toFixed(5)}, ${ponto.lng.toFixed(5)}`;
};
