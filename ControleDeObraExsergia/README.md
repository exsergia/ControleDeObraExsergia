# Exsergia Hub — Controle de Obra

Plataforma web e mobile (PWA) para gestão operacional de obras: cadastro de obras, atividades, materiais, ferramentas, equipes, checklist diário, progresso físico, financeiro e relatórios.

Stack:

- **Frontend**: React 19 + TypeScript + Vite 6 + Tailwind 4
- **Backend**: Supabase (Auth + Postgres + Storage + Realtime)
- **PWA**: service worker com cache-first
- **Roteamento**: react-router-dom 7 (HashRouter)

## Pré-requisitos

- Node.js 18+ (recomendado 20+)
- npm 9+ (vem com Node 18+)
- Conta no Supabase (https://supabase.com) — gratuita já atende

## Instalação

```bash
git clone https://github.com/exsergia/ControleDeObraExsergia.git
cd ControleDeObraExsergia
npm install
```

## Configuração do Supabase

1. Crie um projeto novo em https://supabase.com
2. No painel do projeto, vá em **SQL Editor** e rode o arquivo `supabase/schema.sql`. Esse SQL cria todas as tabelas (`obras`, `materiais`, `atividades`, `checklists`, `operadores`, `tools`, `toolLogs`, etc.), os índices, as policies de RLS, os buckets de Storage e os admins iniciais.
3. (Opcional) Rode também as migrações incrementais na pasta `supabase/migrations/` na ordem do nome.
4. Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publishable-aqui
```

A chave **anon/publishable** é segura para ficar no front — RLS do Supabase protege os dados. **Não use a service_role key no front.**

5. No Supabase, em **Authentication > Settings**, habilite "Email" como provedor. Pode desabilitar confirmação de e-mail durante desenvolvimento.

6. Para criar o primeiro administrador, registre-se pelo app e depois rode no SQL Editor:

```sql
insert into public.admin_access (id, data) values
  ('email:seu-email@dominio.com', '{"tipo":"email","valor":"seu-email@dominio.com","ativo":true}'::jsonb)
on conflict (id) do update set data = excluded.data;
```

## Scripts

```bash
npm run dev       # servidor de desenvolvimento em http://localhost:3000
npm run build     # build de produção em dist/
npm run preview   # serve o build local para teste
npm run lint      # checagem de tipos (tsc --noEmit)
npm run clean     # remove dist/
```

## Deploy

### Vercel (recomendado)

O projeto já vem com `vercel.json` configurado.

```bash
npm install -g vercel
vercel --prod
```

Defina as mesmas variáveis de ambiente (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`) no dashboard da Vercel em **Settings > Environment Variables**.

### Qualquer host estático

```bash
npm run build
```

Depois publique o conteúdo da pasta `dist/` em Netlify, Cloudflare Pages, Nginx, S3+CloudFront, etc.

## Estrutura do projeto

```
src/
├── App.tsx                  # roteador, autenticação, layout, notificações
├── main.tsx                 # bootstrap React + registro do Service Worker
├── index.css                # base Tailwind + ajustes mobile
├── types.ts                 # tipos compartilhados
├── hooks/
│   └── useAutoSaveForm.ts   # rascunho de formulários (sobrevive a fechamento)
├── lib/
│   ├── supabase.ts          # client Supabase + helpers de auth
│   ├── supabaseDb.ts        # camada estilo Firestore sobre tabelas jsonb
│   ├── supabaseHooks.ts     # useCollection com cache em memória + Realtime
│   ├── services.ts          # upload, signed URLs, notificações do browser
│   ├── imageUtils.ts
│   └── utils.ts             # cn (clsx + tailwind-merge)
└── pages/
    ├── Dashboard.tsx        # KPIs gerais
    ├── Obras.tsx            # CRUD obras (admin)
    ├── Materiais.tsx        # entrada/saída de materiais
    ├── Checklist.tsx        # checklist diário (admin)
    ├── Operadores.tsx       # gestão de equipe (admin)
    ├── Atividades.tsx       # cadastro de atividades (admin)
    ├── Progresso.tsx        # avanço físico
    ├── Ferramentas.tsx      # retirada/devolução com QR e foto
    ├── Financeiro.tsx       # custos previstos × executados (admin)
    ├── Relatorios.tsx       # exportações Excel/CSV
    └── Settings.tsx         # preferências de notificação

public/
├── sw.js                    # Service Worker (cache-first, não força reload)
├── manifest.webmanifest     # manifesto PWA
└── icon-*.png               # ícones do app

supabase/
├── schema.sql               # schema principal — rode no SQL Editor
└── migrations/              # migrações incrementais
```

## Comportamento em PWA / Mobile

O Service Worker (`public/sw.js`) implementa:

- **Cache-first** para assets (JS, CSS, imagens, fontes): aberturas seguintes do app são quase instantâneas.
- **Network-first** para `index.html`: você sempre pega a versão mais recente quando há rede.
- **Nunca intercepta** chamadas ao Supabase (API, Auth, Storage, Realtime) — esses dados sempre vêm da rede.
- **Não força atualização** enquanto o app está aberto (sem `skipWaiting`/`clients.claim`). A versão nova só toma o controle quando o usuário **fecha completamente** o app/aba e reabre. Isso evita perder qualquer formulário em edição.

Os formulários usam `useAutoSaveForm` que salva no `localStorage` em:

- Cada digitação
- Ida ao background no celular (`visibilitychange`)
- Fechamento da aba/navegador (`pagehide`, `beforeunload`)
- Mudança de rota (desmonte do componente)

Por isso o usuário pode trocar de tela, minimizar o app, ou ser interrompido por uma ligação, sem perder o que estava preenchendo.

## Login do primeiro usuário

1. Acesse o app pelo browser.
2. Clique em "Cadastre-se" e preencha nome, sobrenome, CPF, e-mail e senha.
3. Confirme o e-mail (se habilitado no Supabase).
4. Para virar administrador, o e-mail precisa estar em `admin_access` (ver passo 6 da configuração).

## Solução de problemas

**"Supabase não respondeu"**: confira `.env` (URL e chave certas), confira se rodou `schema.sql`, confira no painel do Supabase se o projeto não está pausado por inatividade (free tier pausa após 7 dias sem uso).

**Build falha com erro de pacote**: rode `rm -rf node_modules package-lock.json && npm install`.

**Modal cortado no celular**: já está corrigido nesta versão. Se acontecer, reporte o caminho (ex: "Obras > Nova Obra > campo X") para correção.

**App "atualiza sozinho" no mobile**: corrigido nesta versão. Se ainda acontecer depois de uma atualização do app instalado, é esperado fazer um único reload na primeira abertura (para pegar a versão nova do SW). Depois disso fica estável.

## Licença

Privado — uso interno Exsergia.
