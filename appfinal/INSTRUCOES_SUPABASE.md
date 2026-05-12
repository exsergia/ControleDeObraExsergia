# Configuração Supabase

1. Crie um projeto grátis no Supabase.
2. Copie `.env.example` para `.env`.
3. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em `.env`.
4. No Supabase, abra SQL Editor e rode `supabase/schema.sql`.
5. Em Authentication > Providers, ative Email/Password.
6. Para login com Google, ative Google Provider e configure o callback:
   `https://SEU-PROJETO.supabase.co/auth/v1/callback`
7. Para adicionar administradores, insira linhas na tabela `admin_access`:

```sql
insert into public.admin_access (id, data)
values ('email:admin@empresa.com', '{"tipo":"email","valor":"admin@empresa.com","ativo":true}');

insert into public.admin_access (id, data)
values ('cpf:00000000000', '{"tipo":"cpf","valor":"00000000000","ativo":true}');
```

## Permissões no app

- Administrador: acesso total.
- Operador: Dashboard, Ferramentas e Progresso Físico somente visualização.
