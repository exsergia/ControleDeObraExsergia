import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_AUTH_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const OPENAI_MODEL = Deno.env.get('OPENAI_VISION_MODEL') || 'gpt-4o-mini';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type FiscalAnalysis = {
  status: 'aprovado' | 'revisar' | 'reprovado';
  confidence: number;
  documentType: 'NF' | 'Cupom' | 'Outro' | 'Indefinido';
  extractedValue: number | null;
  extractedDate: string | null;
  vendor: string | null;
  reasons: string[];
  warnings: string[];
  rawTextSummary: string;
  model: string;
  analyzedAt: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function normalizeAnalysis(input: any): FiscalAnalysis {
  const status = ['aprovado', 'revisar', 'reprovado'].includes(input?.status) ? input.status : 'revisar';
  const documentType = ['NF', 'Cupom', 'Outro', 'Indefinido'].includes(input?.documentType) ? input.documentType : 'Indefinido';
  const extractedValue = Number.isFinite(Number(input?.extractedValue)) ? Number(input.extractedValue) : null;
  const extractedDate = typeof input?.extractedDate === 'string' && input.extractedDate ? input.extractedDate : null;
  const vendor = typeof input?.vendor === 'string' && input.vendor ? input.vendor.slice(0, 120) : null;

  return {
    status,
    confidence: safeNumber(input?.confidence),
    documentType,
    extractedValue,
    extractedDate,
    vendor,
    reasons: Array.isArray(input?.reasons) ? input.reasons.map(String).slice(0, 5) : ['Analise concluida com baixa estrutura.'],
    warnings: Array.isArray(input?.warnings) ? input.warnings.map(String).slice(0, 5) : [],
    rawTextSummary: typeof input?.rawTextSummary === 'string' ? input.rawTextSummary.slice(0, 500) : '',
    model: OPENAI_MODEL,
    analyzedAt: new Date().toISOString(),
  };
}

function extractOutputText(result: any) {
  if (typeof result?.output_text === 'string') return result.output_text;
  const parts: string[] = [];
  for (const item of result?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function parseModelJson(text: string) {
  const clean = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error('Resposta da IA nao contem JSON valido.');
  }
}

function pending(reason: string, warning: string) {
  return {
    status: 'pendente',
    confidence: 0,
    documentType: 'Indefinido',
    extractedValue: null,
    extractedDate: null,
    vendor: null,
    reasons: [reason],
    warnings: [warning],
    rawTextSummary: '',
    model: OPENAI_MODEL,
    analyzedAt: new Date().toISOString(),
    configured: false,
  };
}

function openAiErrorMessage(detail: string) {
  if (/invalid_api_key|incorrect api key/i.test(detail)) {
    return 'OPENAI_API_KEY invalida. Gere uma nova chave na OpenAI e atualize o secret do Supabase.';
  }
  if (/insufficient_quota|billing|quota/i.test(detail)) {
    return 'A conta OpenAI esta sem saldo/cota para executar a analise.';
  }
  if (/model_not_found|does not have access to model/i.test(detail)) {
    return `A chave OpenAI nao tem acesso ao modelo ${OPENAI_MODEL}.`;
  }
  return 'A OpenAI recusou a analise neste momento. Revise a configuracao da chave e tente novamente.';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405);

  try {
    if (!SUPABASE_URL || !SUPABASE_AUTH_KEY) {
      return json(pending('Supabase da Edge Function nao configurado.', 'Configure SUPABASE_URL e SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY.'), 200);
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sessao obrigatoria.' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_AUTH_KEY);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Sessao invalida.' }, 401);

    if (!OPENAI_API_KEY) {
      return json(pending('OPENAI_API_KEY nao configurada nos secrets do Supabase.', 'Documento salvo sem analise automatica.'));
    }

  const body = await req.json().catch(() => ({}));
  const imageUrl = String(body.imageUrl || '');
  const imageDataUrl = String(body.imageDataUrl || '');
  let dataUrl = '';

  if (imageDataUrl) {
    if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(imageDataUrl)) {
      return json({ error: 'Imagem enviada para scanner em formato invalido.' }, 400);
    }
    if (imageDataUrl.length > 11_000_000) return json({ error: 'Imagem acima do limite de analise.' }, 413);
    dataUrl = imageDataUrl;
  } else {
    if (!/^https?:\/\//i.test(imageUrl)) return json({ error: 'URL da imagem invalida.' }, 400);

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) return json({ error: 'Nao foi possivel baixar a imagem.' }, 400);

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return json({ error: 'Arquivo enviado nao parece ser imagem.' }, 400);

    const imageBuffer = await imageResponse.arrayBuffer();
    if (imageBuffer.byteLength > 8 * 1024 * 1024) return json({ error: 'Imagem acima do limite de analise.' }, 413);

    const bytes = new Uint8Array(imageBuffer);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    dataUrl = `data:${contentType};base64,${btoa(binary)}`;
  }

  const expected = {
    tipo: body.tipo || null,
    valor: body.valor ?? null,
    data: body.data || null,
    despesa: body.despesa || null,
  };

  const prompt = `
Analise a imagem de um lancamento fiscal da empresa.
Objetivo: validar se a foto parece uma Nota Fiscal ou Cupom Fiscal legivel e coerente com os dados digitados.

Dados digitados pelo usuario:
${JSON.stringify(expected, null, 2)}

Responda somente JSON valido, sem markdown, no formato:
{
  "status": "aprovado" | "revisar" | "reprovado",
  "confidence": 0.0,
  "documentType": "NF" | "Cupom" | "Outro" | "Indefinido",
  "extractedValue": 0.0 | null,
  "extractedDate": "YYYY-MM-DD" | null,
  "vendor": "nome do estabelecimento ou emitente" | null,
  "reasons": ["motivos curtos"],
  "warnings": ["pontos de atencao"],
  "rawTextSummary": "resumo curto do texto visivel"
}

Critérios:
- aprovado: documento fiscal legivel e coerente.
- revisar: legibilidade parcial, valor/data incertos ou divergencia pequena.
- reprovado: imagem nao e documento fiscal, esta ilegivel, cortada demais ou claramente incorreta.
- Nunca invente valores: use null quando nao conseguir ler.
- Se o valor lido divergir do digitado por mais de 2%, inclua warning.
- Se a data lida divergir da digitada, inclua warning.
`;

  const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          { type: 'input_image', image_url: dataUrl, detail: 'low' },
        ],
      }],
      max_output_tokens: 900,
    }),
  });

  if (!openaiResponse.ok) {
    const detail = await openaiResponse.text();
    console.error('OpenAI fiscal analysis error', detail);
    return json(pending('Falha na analise de IA.', openAiErrorMessage(detail)), 200);
  }

    const result = await openaiResponse.json();
    const outputText = extractOutputText(result);
    let parsed: any = {};
    try {
      parsed = parseModelJson(outputText);
    } catch {
      parsed = {
        status: 'revisar',
        confidence: 0.2,
        documentType: 'Indefinido',
        reasons: ['A IA respondeu fora do formato esperado.'],
        warnings: ['Revise manualmente este documento.'],
        rawTextSummary: outputText,
      };
    }

    return json({ ...normalizeAnalysis(parsed), configured: true });
  } catch (error) {
    console.error('Fiscal analysis unexpected error', error);
    return json(pending('Scanner da imagem nao conseguiu concluir a leitura.', error instanceof Error ? error.message : 'Erro inesperado na Edge Function.'), 200);
  }
});
