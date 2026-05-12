# Guia rápido - Exsergia Controle de Obra

## 1. Supabase

No Supabase, abra:

SQL Editor > New query

Cole todo o conteúdo de:

supabase/schema.sql

Clique em Run.

Esse SQL cria o banco limpo, sem dados fictícios, com Realtime ativado e com os administradores iniciais:

- nascimentoerick446@gmail.com
- exsergiacel7234@gmail.com

## 2. Supabase Auth

Vá em:

Authentication > Sign In / Providers > Email

Para testes rápidos, desative confirmação de e-mail.

Crie ou atualize o usuário:

Email: nascimentoerick446@gmail.com
Senha: Exsergia@2025

Marque Auto Confirm User.

## 3. Supabase Storage

O SQL cria o bucket público:

uploads

## 4. Vercel

Em Environment Variables, cadastre:

VITE_SUPABASE_URL=https://krbimgxlnyucldfxkvdy.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_LyarOzLLpQjox1EypkoX6g_tFHWZX9T

Depois faça Redeploy sem cache.

## 5. GitHub

Suba tudo para o GitHub:

git init
git add .
git commit -m "app exsergia supabase realtime"
git branch -M master
git remote add origin URL_DO_REPOSITORIO
git push -u origin master

## 6. Atualização automática

O arquivo src/lib/supabaseHooks.ts está configurado com Supabase Realtime.
Sempre que dados forem inseridos, alterados ou apagados nas tabelas, as telas atualizam automaticamente.

## 7. Zerar dados novamente

Se quiser limpar os dados de teste depois, rode:

supabase/zerar_dados.sql
