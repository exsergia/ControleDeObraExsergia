# Alteração - Remoção do login Google

Nesta versão o login via Google foi removido da tela de acesso e do código.

O sistema agora permite apenas:

- Login com e-mail + senha
- Login com CPF + senha
- Cadastro padrão via Supabase Auth

Arquivos ajustados:

- `src/App.tsx`: removido botão "Entrar com Google" e texto da tela.
- `src/lib/supabase.ts`: removida função de OAuth Google.
- `package.json`: removida dependência Google não utilizada.
