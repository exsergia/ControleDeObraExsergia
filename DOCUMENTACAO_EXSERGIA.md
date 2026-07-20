# Documentação Técnica - Exsergia Hub

## 1. Visão Geral

O Exsergia Hub é uma aplicação web/PWA para controle operacional de obras, materiais, progresso físico, ferramentas, frota, notas fiscais/cupons fiscais, financeiro e relatórios.

O sistema usa:

- React + Vite no frontend.
- Supabase para autenticação, banco de dados, storage, realtime e funções edge.
- Vercel para publicação do app web e rotas serverless em `/api/*`.
- PWA para uso em celular, tablet e desktop.
- IA fiscal via Supabase Edge Function para leitura e análise de imagens de NF/Cupom Fiscal.

## 2. Arquitetura

```text
Usuário Web/Mobile/PWA
        |
        | HTTPS
        v
Aplicação React hospedada na Vercel
        |
        | Supabase Client com chave anon pública
        v
Supabase Auth / Database / Storage / Realtime
        |
        | Edge Functions
        v
Scanner IA Fiscal / Notificações

Integrações externas
        |
        | /api/* com Bearer Token Supabase
        v
Vercel Serverless API
        |
        | Service Role somente no servidor
        v
Supabase
```

## 3. Stack Técnica

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| UI | Tailwind CSS, Lucide React, Motion |
| Banco | Supabase Postgres |
| Auth | Supabase Auth |
| Storage | Supabase Storage, bucket `uploads` |
| Realtime | Supabase Realtime |
| API | Vercel Serverless Functions em `/api/*` |
| IA | Supabase Edge Function + OpenAI Vision |
| Exportação | XLSX |
| PWA | `manifest.webmanifest` e service worker |

## 4. Variáveis de Ambiente

Frontend:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

API serverless na Vercel:

```env
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
```

Supabase Edge Function da IA fiscal:

```bash
supabase secrets set OPENAI_API_KEY=...
supabase secrets set OPENAI_VISION_MODEL=gpt-4o-mini
```

Observações importantes:

- `VITE_SUPABASE_ANON_KEY` pode ficar no frontend.
- `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser usada no frontend.
- `OPENAI_API_KEY` fica somente como secret da Supabase Edge Function.

## 5. Banco de Dados

As tabelas principais seguem o padrão de `id` + `data jsonb`, com algumas colunas planas para performance, filtros e políticas.

Principais tabelas:

- `obras`
- `atividades`
- `materiais`
- `checklists`
- `progresso_diario`
- `operadores`
- `admin_access`
- `encarregados`
- `tools`
- `toolLogs`
- `vehicles`
- `vehicleLogs`
- `fiscal_docs`
- `equipamentos`
- `equipamento_manutencoes`
- `equipamento_locacoes`
- `push_subscriptions`

Scripts principais:

- `supabase/schema.sql`: estrutura completa do banco.
- `supabase/migrations/*`: migrações incrementais.
- `supabase/zerar_dados.sql`: limpeza controlada de dados.

## 6. Autenticação e Login

O login usa Supabase Auth.

O usuário pode acessar com:

- e-mail;
- CPF cadastrado;
- telefone/celular cadastrado.

O CPF e telefone são resolvidos para o e-mail vinculado antes do login. A senha continua sendo validada pelo Supabase Auth.

Recuperação de senha:

- feita pelo fluxo padrão do Supabase;
- o usuário recebe link por e-mail;
- a troca de senha também existe dentro da aba Configurações.

## 7. Perfis e Permissões

### Administrador

Tem acesso completo:

- cadastrar, editar e excluir dados;
- editar obras;
- gerenciar operadores;
- acessar financeiro;
- acessar relatórios;
- visualizar todos os documentos fiscais;
- editar NF/Cupom Fiscal;
- exportar dados.

Administradores são definidos na tabela `admin_access`.

Exemplo por e-mail:

```sql
insert into public.admin_access (id, data)
values (
  'email:admin@exsergia.eng.br',
  '{"tipo":"email","valor":"admin@exsergia.eng.br","ativo":true}'
);
```

Exemplo por CPF:

```sql
insert into public.admin_access (id, data)
values (
  'cpf:00000000000',
  '{"tipo":"cpf","valor":"00000000000","ativo":true}'
);
```

### Encarregado

Tem acesso operacional ampliado, vinculado às obras sob responsabilidade.

### Operador

Permissões focadas em campo:

- visualizar módulos operacionais;
- lançar NF/Cupom Fiscal;
- visualizar somente as notas/cupons que ele lançou;
- retirar e devolver ferramentas;
- ver ferramentas atualmente com ele;
- preencher checklists;
- atualizar progresso quando liberado pelo fluxo do app.

Edição e alteração de informações sensíveis ficam restritas a administradores.

## 8. Módulos do Sistema

### Dashboard

Mostra indicadores gerais, cards de resumo, últimas entregas, checklists recentes e atalhos de navegação.

Os botões `Ver todas` encaminham para as telas correspondentes.

### Obras

Gerencia o cadastro das obras.

Funcionalidades:

- criar obra;
- editar obra;
- definir cliente;
- definir centro de custo;
- definir status: Ativa, Pausada ou Concluída;
- vincular equipe/responsáveis;
- filtrar e buscar obras.

Observação: atividades independentes foram removidas da aba Obras conforme regra atual. Obra é tratada separadamente de atividade.

### Progresso Físico

Controla execução de atividades.

Regras importantes:

- atividades com 100% de execução saem da tela principal de Progresso Físico;
- obras concluídas também deixam de aparecer no progresso ativo;
- os dados já registrados permanecem salvos no banco para relatórios e histórico.

### Materiais

Controla entrada, conferência e custo de materiais.

Campos principais:

- obra;
- descrição;
- unidade;
- quantidade;
- custo unitário;
- custo total;
- fornecedor;
- foto;
- status de conferência.

### Ferramentas

Controla inventário e movimentação de ferramentas.

Funcionalidades:

- cadastro com categoria;
- busca por ferramenta;
- categorias cadastráveis;
- opção `Outros` como última categoria;
- retirada por usuário;
- devolução com foto;
- previsão de devolução;
- histórico de movimentações;
- visão de ferramentas atualmente com o usuário.

### Frota

Controla veículos, retirada, devolução, fotos de painel, localização e avarias.

### NF / Cupom Fiscal

Módulo para lançamento fiscal com foto.

Regras atuais:

- operadores podem cadastrar NF/Cupom Fiscal;
- operadores veem somente as notas/cupons lançados por eles;
- administradores veem todos os documentos;
- administradores podem editar;
- campo `Despesas` substitui o antigo campo fornecedor;
- despesas disponíveis: `ALMOÇO`, `JANTA`, `CAFE`, `ESTACIONAMENTO`, `HOSPEDAGEM`, `MATERIAL`;
- despesa não é obrigatória;
- há campo de observação;
- filtros por obra e pessoas envolvidas;
- integração com scanner IA.

### Financeiro

Painel consolidado para administradores.

Inclui:

- custos operacionais;
- receitas registradas;
- resultado operacional;
- patrimônio cadastrado;
- filtros por obra;
- resumo por origem;
- exportação para Excel.

Observação: a área de auditoria de campo foi removida do Financeiro conforme regra atual.

### Relatórios

Consolida relatórios diários, ferramentas, frota, NF/Cupom Fiscal e Dashboard BI.

Na parte de ferramentas:

- Histórico de movimentações aparece antes de Inventário;
- é possível pesquisar por ferramenta e cliente;
- mostra tempo de uso previsto conforme a retirada.

## 9. IA Fiscal

A análise de imagem de NF/Cupom Fiscal é feita pela Edge Function:

```text
supabase/functions/analyze-fiscal-image/index.ts
```

Fluxo:

1. Usuário seleciona ou fotografa a NF/Cupom.
2. O app envia a imagem para scanner.
3. A Edge Function valida o usuário autenticado.
4. A imagem é enviada ao modelo de visão.
5. A função retorna status, valor extraído, data, fornecedor/despesa provável e avisos.
6. O resultado é salvo em `fiscal_docs.data.aiAnalysis`.

Status possíveis:

- `aprovado`
- `revisar`
- `reprovado`
- `pendente`

Sobre tokens:

- a imagem analisada é convertida em entrada visual para o modelo;
- o processamento consome tokens conforme tamanho/detalhe da imagem;
- o app usa `detail: low` para reduzir custo;
- a imagem em si fica salva no Supabase Storage quando o lançamento é salvo.

## 10. API Serverless

Foi criada uma API em `/api/*` para integrações externas e uso futuro.

Arquivos principais:

- `api/_lib/api.js`
- `api/health.js`
- `api/fiscal-docs.js`
- `api/records.js`
- `api/README.md`

### Autenticação da API

Rotas protegidas exigem:

```http
Authorization: Bearer <access_token_do_supabase>
```

### Rotas

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/api/health` | Verifica configuração da API |
| GET | `/api/fiscal-docs` | Lista NF/Cupom Fiscal |
| POST | `/api/fiscal-docs` | Cria NF/Cupom Fiscal |
| PATCH | `/api/fiscal-docs?id=<id>` | Edita NF/Cupom Fiscal |
| GET | `/api/records?table=obras` | Lista registros de tabela permitida |
| POST/PUT/PATCH | `/api/records?table=fiscal_docs` | Grava registros permitidos |

Regras:

- admin pode ver tudo;
- operador vê apenas dados próprios em rotas sensíveis;
- escrita geral é restrita;
- `SUPABASE_SERVICE_ROLE_KEY` fica somente no servidor da Vercel.

### Vercel

O `vercel.json` possui rewrite específico:

```json
{ "source": "/api/(.*)", "destination": "/api/$1" }
```

Isso impede que chamadas de API caiam no `index.html`.

## 11. PWA, Mobile e Plataformas

O app foi ajustado para funcionar em:

- desktop;
- Android;
- iPhone/iOS;
- tablets;
- navegador mobile;
- modo instalado como PWA.

Boas práticas aplicadas:

- layout responsivo;
- botões com altura/alinhamento consistente;
- cards adaptáveis;
- modais mais amigáveis no mobile;
- inputs maiores e legíveis;
- prevenção de recarregamentos desnecessários;
- persistência de abas/formulários onde aplicável.

## 12. Persistência e Salvamento

O app grava dados no Supabase.

Para reduzir perda de dados:

- formulários críticos usam estado local;
- algumas abas usam persistência de estado;
- cadastros devem ser confirmados com gravação no banco;
- erros transitórios de Supabase recebem retry em operações importantes.

Ponto de atenção: dados digitados e ainda não enviados ao Supabase não são considerados salvos definitivamente.

## 13. Segurança

Camadas de segurança:

- Supabase Auth;
- Row Level Security;
- tabela `admin_access`;
- validação de token nas Edge Functions;
- validação de token na API serverless;
- service role somente no servidor;
- separação entre chave pública anon e chaves secretas.

Não é possível visualizar senhas de usuários. O Supabase Auth armazena senhas com hash, e a forma correta de resolver perda de senha é recuperação/troca de senha.

## 14. Deploy

Checklist de deploy:

1. Rodar `npm run lint`.
2. Rodar `npm run build`.
3. Confirmar variáveis no Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Confirmar secrets no Supabase:
   - `OPENAI_API_KEY`
   - `OPENAI_VISION_MODEL`, opcional
5. Subir migrations necessárias no Supabase.
6. Fazer commit e push.
7. Validar login, cadastro, NF/Cupom, upload de foto e relatórios em produção.

## 15. Testes e Validação

Comandos locais:

```bash
npm install
npm run dev
npm run lint
npm run build
```

Validações manuais recomendadas:

- login com e-mail;
- login com CPF;
- login com telefone;
- cadastro de obra;
- edição de obra como admin;
- bloqueio de edição para operador;
- lançamento de NF/Cupom como operador;
- visualização de NF/Cupom própria pelo operador;
- visualização de todas as NF/Cupom pelo admin;
- scanner IA de imagem fiscal;
- filtros financeiro/relatórios;
- PWA em Android e iPhone.

## 16. Principais Cuidados em Produção

- Não expor `SUPABASE_SERVICE_ROLE_KEY`.
- Não expor `OPENAI_API_KEY`.
- Manter RLS ativo.
- Validar migrations antes de deploy.
- Evitar apagar dados diretamente no banco sem backup.
- Testar cadastro/login em celular após mudanças de auth.
- Conferir se rotas `/api/*` respondem JSON e não HTML.
- Monitorar falhas de rede em Supabase e Vercel.

## 17. Roadmap Sugerido

- OCR fiscal mais completo com conferência de CNPJ e número do documento.
- Fila de reprocessamento para imagens fiscais com falha.
- Logs administrativos de alterações sensíveis.
- Dashboard executivo com metas por obra.
- Modo offline completo com sincronização posterior.
- Integração direta com Power BI online.
- Alertas automáticos por WhatsApp/e-mail para devoluções atrasadas.

---

Documentação técnica atualizada para o estado atual do Exsergia Hub.
