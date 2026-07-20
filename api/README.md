# API Exsergia Hub

Rotas serverless para Vercel em `/api/*`.

## Configuração

Variáveis necessárias no ambiente da Vercel:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` é usada apenas no servidor. Não exponha essa chave no frontend.

## Autenticação

Rotas protegidas exigem o token de sessão Supabase:

```http
Authorization: Bearer <access_token_do_supabase>
```

O token pode ser obtido depois do login no app via Supabase Auth.

## Regras de Acesso

- Administrador: pode consultar dados gerais e gravar nas rotas permitidas.
- Operador: em rotas sensíveis, visualiza somente dados próprios.
- Escrita genérica pela API é bloqueada para operador, exceto quando explicitamente permitido.
- `fiscal_docs` permite lançamento por usuário autenticado.

## Rotas

### Health

```http
GET /api/health
```

Resposta:

```json
{
  "ok": true,
  "service": "exsergia-api",
  "supabaseConfigured": true,
  "timestamp": "2026-07-20T12:00:00.000Z"
}
```

### Listar NF/Cupom Fiscal

```http
GET /api/fiscal-docs?limit=100&search=almoco&obraId=OBRA_ID&pessoa=erick
Authorization: Bearer <token>
```

Filtros:

- `limit`
- `search` ou `q`
- `obraId`
- `pessoa`

Resposta:

```json
{
  "ok": true,
  "admin": false,
  "count": 1,
  "items": []
}
```

### Criar NF/Cupom Fiscal

```http
POST /api/fiscal-docs
Authorization: Bearer <token>
Content-Type: application/json
```

Payload:

```json
{
  "tipo": "Cupom",
  "fotoUrl": "https://...",
  "valor": 36.96,
  "data": "2026-07-20",
  "fornecedor": "ALMOÇO",
  "cartaoFinal": "1234",
  "observacoes": "Almoço da equipe",
  "obraId": "obra-123",
  "obraNome": "3061x26 - Obra Exemplo",
  "operadoresPresentes": [
    { "id": "user-id", "nome": "Erick Nascimento" }
  ]
}
```

Resposta:

```json
{
  "ok": true,
  "item": {
    "id": "uuid",
    "tipo": "Cupom",
    "valor": 36.96
  }
}
```

### Editar NF/Cupom Fiscal

```http
PATCH /api/fiscal-docs?id=<id>
Authorization: Bearer <token>
Content-Type: application/json
```

Payload parcial:

```json
{
  "valor": 42.5,
  "observacoes": "Valor corrigido"
}
```

O `PATCH` preserva os campos existentes e atualiza somente os campos enviados.

### Listar Registros Genéricos

```http
GET /api/records?table=obras&limit=100&search=3061
Authorization: Bearer <token>
```

Tabelas liberadas:

- `obras`
- `materiais`
- `atividades`
- `checklists`
- `progresso_diario`
- `tools`
- `toolLogs`
- `vehicles`
- `vehicleLogs`
- `fiscal_docs`
- `equipamentos`
- `equipamento_manutencoes`
- `equipamento_locacoes`
- `operadores`

Filtros:

- `limit`
- `search` ou `q`
- `obraId`
- `status`

### Gravar Registro Genérico

```http
POST /api/records?table=fiscal_docs
Authorization: Bearer <token>
Content-Type: application/json
```

Payload:

```json
{
  "tipo": "NF",
  "fotoUrl": "https://...",
  "valor": 100,
  "data": "2026-07-20"
}
```

Métodos aceitos:

- `POST`: cria ou substitui pelo `id` enviado.
- `PUT`: cria ou substitui pelo `id` enviado.
- `PATCH`: preserva registro existente e altera somente campos enviados.

## CORS

As rotas respondem `OPTIONS` e liberam:

- `GET`
- `POST`
- `PUT`
- `PATCH`
- `OPTIONS`

## Erros Comuns

### 401 Token de acesso ausente

A chamada não enviou:

```http
Authorization: Bearer <token>
```

### 401 Token inválido ou expirado

O usuário precisa fazer login novamente.

### 500 API sem configuração

Falta configurar `VITE_SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` no ambiente da Vercel.

### HTML no lugar de JSON

Confirme se o `vercel.json` tem o rewrite:

```json
{ "source": "/api/(.*)", "destination": "/api/$1" }
```
