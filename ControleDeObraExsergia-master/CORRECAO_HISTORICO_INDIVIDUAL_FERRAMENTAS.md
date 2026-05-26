# Correção - Histórico individual de ferramentas

Esta versão ajusta o histórico para não replicar o mesmo horário em todos os cards.

## Regra aplicada

- Cada retirada cria um registro próprio em `toolLogs`.
- O campo `dataSaida` é gravado somente no momento da retirada.
- O campo `dataDevolucao` é gravado somente no momento da devolução.
- A devolução não altera `dataSaida`.
- A interface não usa `new Date()` como fallback para mostrar horários.
- Se um log antigo não tiver data gravada, a tela mostra `--/--/---- --:--` em vez de inventar o horário atual.

## Observação importante

Registros antigos que já foram salvos com horário errado ou replicado não têm como recuperar o horário real automaticamente, porque esse horário original não existe mais no banco. A correção garante o comportamento correto para os próximos registros e para qualquer registro antigo que já tenha `dataSaida` e `dataDevolucao` próprios.
