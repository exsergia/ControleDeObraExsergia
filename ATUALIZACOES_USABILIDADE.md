# Atualizações de usabilidade e performance

## Corrigido nesta versão

1. Cadastro de obra
- O botão "Criar Obra" agora fica desabilitado durante o salvamento.
- Isso impede cadastro duplicado por duplo clique.
- Também foi adicionada validação para não cadastrar a mesma obra com mesmo nome e cliente.

2. Equipe e níveis
- Os cartões de operadores agora são selecionados ao clicar em qualquer área do cartão.
- O campo de nível deixou de ser campo digitável e virou seletor.
- Elementos de seleção usam cursor de clique, não cursor de digitação.

3. Materiais
- A unidade do lançamento de material ficou fixa em UN.
- O usuário não consegue digitar nem alterar a unidade manualmente.

4. Campos numéricos
- Campos numéricos não aceitam negativo.
- Ao digitar um número, o zero inicial some.
- Foram bloqueados caracteres como -, +, e e E em campos numéricos.

5. Performance
- O Realtime continua ativo, mas com debounce maior para evitar múltiplas recargas seguidas.
- A tela não entra em carregamento visual a cada atualização em tempo real, mantendo os dados anteriores até chegar a nova consulta.
- Foram adicionados índices no SQL para melhorar consultas e evitar obra duplicada.

## Arquivo SQL
Rode novamente no Supabase:

supabase/schema.sql

Atenção: este SQL zera dados de operação e mantém os administradores iniciais cadastrados no arquivo.
