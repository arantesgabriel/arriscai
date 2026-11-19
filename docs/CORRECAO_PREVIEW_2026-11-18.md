# Pipeline Preview e conteúdo editorial privado

## Causa

A limpeza de privacidade introduziu uma dependência incorreta: a migration `202611170007` exigia uma variável de sessão contendo texto aprovado quando o registro já existia. O Preview aplica migrations automaticamente e não prepara essa sessão editorial. Por isso o bloco levantava `P0001` antes de concluir o deploy.

Referências oficiais: [GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration) e [migration behavior](https://supabase.com/docs/guides/deployment/branching/working-with-branches).

## Correção

- `202611170007` mantém sua versão como marcador sem conteúdo e sem entrada interativa. É necessário corrigir esse arquivo porque uma migration posterior nunca seria alcançada no pipeline que está bloqueado nele.
- `202611180001` instala `private.apply_q0710_editorial_patch(text)` sem executá-la. A nova versão também atende bases que já tinham registrado `202611170007` como aplicada.
- O texto não volta ao repositório. A operação é privada, usa `SECURITY INVOKER`, `search_path` vazio e não concede execução a `PUBLIC`, `anon` ou `authenticated`.
- A função valida o fingerprint do texto aprovado e do registro anterior, preserva autoria e alterações editoriais divergentes, e evita escrever novamente quando o texto já está corrigido.

**A migration passar não significa que o conteúdo foi corrigido.** A correção do item continua sendo uma operação administrativa separada, com texto fornecido privadamente. O banco não foi alterado por este trabalho.

## Retomada do pipeline

Publicar o commit pelo fluxo habitual e reexecutar o deploy do Preview. Não há necessidade de apagar a branch, resetar dados ou marcar a migration como aplicada à força para corrigir essa causa. O resultado hospedado deve ser conferido nos logs depois dessa execução; testes locais não substituem essa verificação.

## Regressão

`npm run test:migrations` agora também executa `scripts/test-preview-editorial.mjs`. Usa PGlite e dados fictícios para testar:

- Upgrade com Q0710 já presente e sem configuração de sessão, preservando seus dados.
- Banco novo sem esse registro e repetição da nova migration de schema.
- Permissões negadas aos papéis de cliente e a `PUBLIC`.
- Rejeição de entrada ausente, vazia ou não aprovada, sem alteração do registro.
- Mesmo corpo da função com fingerprints de fixtures fictícias: atualização válida, repetição idempotente e recusa de alteração posterior, categoria, resposta, aliases ou dono divergentes e registro ausente.

Nenhum enunciado oficial foi reintroduzido, nenhum segredo foi adicionado e nenhuma operação remota foi executada.

Checks locais concluídos: lint e typecheck sem erros; 24 testes unitários; 28 checks SQL; suíte de upgrade (incluindo o cenário Preview e as permissões da função); testes de guardas editoriais e apelidos. Todos passaram. Nenhuma interface foi modificada, portanto não houve nova validação visual. O pipeline Supabase hospedado ainda precisa ser reexecutado com o commit corrigido.
