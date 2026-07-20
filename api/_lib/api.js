import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const API_TABLES = new Set([
  'obras',
  'materiais',
  'atividades',
  'checklists',
  'progresso_diario',
  'tools',
  'toolLogs',
  'vehicles',
  'vehicleLogs',
  'fiscal_docs',
  'equipamentos',
  'equipamento_manutencoes',
  'equipamento_locacoes',
  'operadores',
]);

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.end(JSON.stringify(body));
}

export function handleOptions(req, res) {
  if (req.method !== 'OPTIONS') return false;
  sendJson(res, 204, {});
  return true;
}

export function getServerSupabase() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('API sem SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY configurado.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function requireUser(req, res, supabase) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    sendJson(res, 401, { ok: false, error: 'Token de acesso ausente.' });
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    sendJson(res, 401, { ok: false, error: 'Token de acesso invalido ou expirado.' });
    return null;
  }

  return data.user;
}

export async function isAppAdmin(supabase, user) {
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email) return false;

  const { data, error } = await supabase
    .from('admin_access')
    .select('id,data')
    .eq('id', `email:${email}`)
    .maybeSingle();

  if (error) return false;
  return Boolean(data && data.data?.ativo !== false);
}

export async function getOperatorProfile(supabase, user) {
  const { data } = await supabase
    .from('operadores')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!data) return null;
  return unwrapRow(data);
}

export function unwrapRow(row) {
  return { id: row.id, ...(row.data || {}) };
}

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function toPositiveInt(value, fallback = 100, max = 500) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw.trim() ? JSON.parse(raw) : {};
}

export function sanitizeFiscalPayload(input, user, operatorProfile) {
  const payload = {
    tipo: input.tipo === 'NF' ? 'NF' : 'Cupom',
    fotoUrl: String(input.fotoUrl || '').trim(),
    valor: Number(input.valor || 0),
    data: input.data || new Date().toISOString().slice(0, 10),
    fornecedor: input.fornecedor ? String(input.fornecedor).trim() : undefined,
    cartaoFinal: input.cartaoFinal ? String(input.cartaoFinal).trim().slice(-4) : undefined,
    observacoes: input.observacoes ? String(input.observacoes).trim() : undefined,
    obraId: input.obraId ? String(input.obraId).trim() : undefined,
    obraNome: input.obraNome ? String(input.obraNome).trim() : undefined,
    operadoresPresentes: Array.isArray(input.operadoresPresentes) ? input.operadoresPresentes : [],
    aiAnalysis: input.aiAnalysis || undefined,
    criadoPorId: user.id,
    criadoPorNome: operatorProfile?.nome || user.email || 'Usuario',
    createdAt: new Date().toISOString(),
  };

  if (!payload.fotoUrl) throw new Error('fotoUrl e obrigatorio.');
  if (!Number.isFinite(payload.valor) || payload.valor <= 0) throw new Error('valor precisa ser maior que zero.');

  return payload;
}
