# Exsergia - Controle de Obra com Supabase

Este projeto foi refeito para usar Supabase como backend:

- Supabase Auth: login por Google, e-mail/senha e CPF/senha.
- Supabase Database: dados do app em tabelas Postgres com `data jsonb`.
- Supabase Storage: upload de fotos e anexos no bucket `uploads`.
- Controle de acesso por `admin_access`.

## Como configurar

1. Crie um projeto gratuito no Supabase.
2. Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

3. No Supabase, vá em **SQL Editor** e rode o arquivo:

```text
supabase/schema.sql
```

4. Em **Authentication > Providers**, ative:

- Email/Password
- Google, se quiser login com Google

5. Para rodar local:

```bash
npm install
npm run dev
```

## Administradores

A tabela que define administradores é:

```text
admin_access
```

Exemplo por e-mail:

```sql
insert into public.admin_access (id, data)
values ('email:admin@empresa.com', '{"tipo":"email","valor":"admin@empresa.com","ativo":true}');
```

Exemplo por CPF:

```sql
insert into public.admin_access (id, data)
values ('cpf:00000000000', '{"tipo":"cpf","valor":"00000000000","ativo":true}');
```

## Permissões no app

- Administrador: acesso total.
- Operador: Dashboard, Ferramentas e Progresso Físico somente visualização.
