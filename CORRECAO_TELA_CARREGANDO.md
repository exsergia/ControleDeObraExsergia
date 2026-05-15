# Correção da tela carregando infinitamente

O app podia ficar preso no carregamento quando o Supabase não respondia durante a inicialização da sessão ou na busca do perfil do usuário.

Isso geralmente acontece quando:

1. O arquivo `.env` está ausente ou com URL/chave errada.
2. A URL copiada do Supabase não é a Project URL correta.
3. A chave usada é a Secret Key em vez da Publishable Key.
4. O arquivo `supabase/schema.sql` ainda não foi rodado no SQL Editor.
5. O navegador ficou com uma sessão antiga salva no localStorage.

## O que foi alterado

- Adicionado timeout na inicialização do Supabase.
- Adicionado timeout nas consultas de perfil/admin.
- Se o Supabase falhar, o app sai do carregamento e volta para a tela de login.
- Adicionada mensagem de erro explicando para verificar `.env`, URL, chave e schema.

## Depois de atualizar

1. Feche o navegador.
2. Pare o terminal com `Ctrl + C`.
3. Rode:

```bash
npm install
npm run dev
```

4. Abra:

```text
http://localhost:3000
```

5. Se ainda não abrir, limpe o cache/localStorage do navegador ou teste em aba anônima.
