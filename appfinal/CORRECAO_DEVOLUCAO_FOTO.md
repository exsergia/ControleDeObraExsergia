# Correção - Foto da Devolução de Ferramenta

Correções aplicadas na tela de Ferramentas:

- O campo de foto da devolução não submete mais o formulário automaticamente.
- O botão de devolução agora é `type="button"`, evitando recarregamento da página.
- A foto tirada/anexada aparece imediatamente no campo correto.
- A foto fica salva temporariamente no navegador como rascunho da devolução, evitando perda caso o navegador troque de aba ou recarregue.
- Ao clicar em Confirmar Devolução, a imagem é enviada para o Supabase Storage no bucket `uploads`.
- O link público da imagem é gravado no banco na tabela `toolLogs`, campo `fotoDevolucaoUrl`.
- Após concluir a devolução, a ferramenta volta para status `Disponível`.
- O pacote `react-is` foi adicionado nas dependências para evitar erro de build do Recharts/Vite.

Validação realizada:

```bash
npm install --legacy-peer-deps
npm run build
```

Build concluído com sucesso.
