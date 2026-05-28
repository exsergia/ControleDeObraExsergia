# Melhoria no sistema de horários das ferramentas

Alterações aplicadas em `src/pages/Ferramentas.tsx`:

- Horário de retirada e devolução agora são lidos somente dos campos salvos no banco (`dataSaida` e `dataDevolucao`).
- Removido fallback visual com `new Date()` para não aparecer horário atual quando um campo estiver ausente.
- Exibição fixada no fuso `America/Sao_Paulo`, evitando mudança visual conforme o fuso/local do celular ou computador.
- Retirada salva um timestamp fixo no momento da confirmação.
- Devolução salva um timestamp fixo no momento da confirmação.
- Devolução não regrava mais `dataSaida`, preservando o horário original de retirada.
- Adicionado cálculo de tempo em uso após devolução.

Validação:

- `npm run build` executado com sucesso.
