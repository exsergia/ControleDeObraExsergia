# Alteração - Operadores visíveis no Supabase

## O que mudou

- A tabela `operadores` agora possui colunas visíveis no Supabase:
  - `nome`
  - `sobrenome`
  - `email`
  - `cpf`
  - `telefone`
  - `funcao`
  - `role`

Antes esses dados ficavam somente dentro da coluna `data` em JSON, dificultando identificar qual ID excluir.

## Atualização automática dos nomes

O sistema continua usando o cadastro central da tabela `operadores`. Assim, quando o operador/administrador atualizar nome ou sobrenome, as telas que buscam o operador pelo ID passam a exibir o nome atualizado.

Também foi adicionado `responsavelId` nos logs de ferramentas novos, para que o nome do responsável venha do cadastro central quando possível.

## Qual SQL rodar

Se você NÃO quer apagar os dados atuais, rode:

```text
supabase/migracao_operadores_visiveis.sql
```

Se você quer recriar o banco zerado, rode:

```text
supabase/schema.sql
```

Atenção: `schema.sql` zera as tabelas do sistema.
