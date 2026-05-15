# Correção - Horários fixos nos logs de ferramentas

Alterações aplicadas:

- O horário de retirada (`dataSaida`) é gravado uma única vez no momento da retirada.
- O horário de devolução (`dataDevolucao`) é gravado uma única vez no momento da devolução.
- A tela de Logs de Movimentação não usa mais `new Date()` como fallback visual, evitando que logs antigos exibam o horário atual.
- Cada card de log mostra separadamente:
  - Retirada em: data e hora do próprio log.
  - Devolução em: data e hora do próprio log, ou `--/--/---- --:--` quando ainda estiver pendente.
- A devolução preserva a `dataSaida` original e apenas preenche `dataDevolucao`.
- Mantidas as correções anteriores de câmera mobile com `capture="environment"`, upload privado e URL assinada.

Arquivo principal alterado:

- `src/pages/Ferramentas.tsx`

Arquivos de tipo/documentação alterados:

- `src/types.ts`
- `CORRECAO_HORARIOS_FIXOS_FERRAMENTAS.md`
