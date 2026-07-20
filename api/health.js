import { getServerSupabase, handleOptions, sendJson } from './_lib/api.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  try {
    getServerSupabase();
    sendJson(res, 200, {
      ok: true,
      service: 'exsergia-api',
      supabaseConfigured: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      service: 'exsergia-api',
      supabaseConfigured: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
