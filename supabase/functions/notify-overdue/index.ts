// Edge Function: notify-overdue
// Varre os toolLogs abertos cuja previsão de devolução venceu e envia
// uma notificação Web Push para o responsável (funciona com o app fechado).
//
// Acionada pelo agendador (pg_cron) via net.http_post, com o header
// `x-cron-secret`. Deploy com --no-verify-jwt.
//
// Secrets necessários (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@exsergia.com.br';
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req) => {
  // Autenticação simples por segredo compartilhado com o agendador.
  if (CRON_SECRET) {
    const got = req.headers.get('x-cron-secret');
    if (got !== CRON_SECRET) return new Response('unauthorized', { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const now = Date.now();

  const { data: logRows, error: logErr } = await supabase.from('toolLogs').select('*');
  if (logErr) return new Response(JSON.stringify({ error: logErr.message }), { status: 500 });

  const overdue = (logRows || [])
    .map((r: any) => ({ id: r.id, ...(r.data || {}) }))
    .filter((l: any) => l.statusLog === 'Aberta' && l.previsaoDevolucao && new Date(l.previsaoDevolucao).getTime() < now);

  if (overdue.length === 0) {
    return Response.json({ overdue: 0, sent: 0 });
  }

  const { data: toolRows } = await supabase.from('tools').select('*');
  const tools: Record<string, any> = Object.fromEntries((toolRows || []).map((r: any) => [r.id, r.data || {}]));

  const { data: subRows } = await supabase.from('push_subscriptions').select('*');
  const subsByUser: Record<string, Array<{ id: string; endpoint: string; keys: any }>> = {};
  for (const r of subRows || []) {
    const d = (r as any).data || {};
    if (!d.userId || !d.endpoint || !d.keys) continue;
    (subsByUser[d.userId] ||= []).push({ id: (r as any).id, endpoint: d.endpoint, keys: d.keys });
  }

  let sent = 0;
  for (const log of overdue) {
    const subs = subsByUser[log.responsavelId] || [];
    if (subs.length === 0) continue;
    const toolName = tools[log.toolId]?.nome || 'Ferramenta';
    const payload = JSON.stringify({
      title: 'Ferramenta em atraso',
      body: `"${toolName}" passou do prazo de devolução. Renove ou devolva o quanto antes.`,
      url: '/#/ferramentas',
      tag: `atraso-${log.id}`,
    });

    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
        sent += 1;
      } catch (err: any) {
        // Inscrição expirada/cancelada → remove para não tentar de novo.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', s.id);
        }
      }
    }
  }

  return Response.json({ overdue: overdue.length, sent });
});
