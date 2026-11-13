# Relatório de implementação e aceite

Execução local em 13/11/2026, Windows, Node 24.21.0. Next.js 16.4.6, React 19, Supabase JS 2; versões resolvidas no lockfile. Sem projeto Supabase/Vercel configurado e sem Docker/CLI Supabase.

## Executado

| Verificação | Resultado |
|---|---|
| ESLint | Passou, sem erros/avisos |
| TypeScript | Passou |
| Build Next.js com Webpack | Passou; home estática e sala dinâmica |
| Vitest | 13 testes passaram |
| Migration + seed + RLS + RPC | 25 verificações passaram em PostgreSQL embarcado PGlite |
| Playwright Chromium | Um fluxo integrado completo passou, com três BrowserContexts independentes |
| Screenshots | 28 PNGs em `docs/screenshots` |
| Larguras | 390, 768, 1440, 1920; overflow horizontal recusado em cada captura |

Build Turbopack inicialmente falhou em subprocesso de PostCSS neste sandbox Windows; scripts usam Webpack. Vitest precisou TEMP/TMP graváveis; Playwright/servidor precisaram execução fora do sandbox para comunicação entre processos. Essas falhas de ambiente foram corrigidas para concluir a validação local. CI foi adicionada, mas não executada no GitHub.

## Fluxo de browser efetivamente exercitado

Host cria sala, jogador e telão entram com identidades distintas, host prepara uma rodada de 22 palavras, os três recebem estado automaticamente. Seleção não revela palavra. Confirmação revela uma palavra. Jogador reconecta por reload e recupera snapshot. Host registra resposta, recebe sugestão e decide acerto; jogador recebe 22 pontos. Avanço manual gera resultado/histórico. Host escolhe outro organizador; nova partida começa e o placar volta a zero. O telão continua fora do rodízio.

Ataques por fetch do próprio browser: jogador chama snapshot privado e é recusado; telão tenta comando e é recusado. Duas seleções simultâneas com mesma versão dão um sucesso e um conflito. UI pública recebe apenas snapshot saneado. Os snapshots antes do reveal não contêm respostas, aliases, IDs de perguntas ou palavras ocultas. O tabuleiro do telão cabe na altura visível nas larguras 1440 e 1920 usadas no teste.

O transporte Auth/Phoenix/Broadcast desse teste é um adaptador em `tests/e2e/sql-harness.ts`. Ele chama o SQL real sob `SET LOCAL ROLE authenticated` e claims distintas. **Não é Supabase real e não comprova JWT assinado, RLS do gateway hospedado ou serviço WebSocket hospedado.** Não é usado pelo produto. Ative `ARRISCAI_LIVE_E2E=1` com as variáveis públicas reais para rodar o mesmo fluxo sem adaptador em projeto de teste autorizado.

## Regras e segurança SQL

Resultados individuais em `docs/db-test-results.json`. Incluem leitura indevida de tabelas privadas e de sala alheia, negação de escrita direta, conta anônima vs permanente, filtros insuficientes, espectador tardio, seleção/confirmação, desfazer, comparação privada, decisão humana, idempotência, versão obsoleta, fases, rotação, pausa, pulo de desconectado, ajustes limitados à reserva, erro/desistência, última palavra, resultado, nova partida, empate, falta de reserva, preparação de pergunta própria antes do desempate, policies de Broadcast/Presence e bloqueio de provisórias no lançamento. Pontuação verificada no SQL para +22, +19 e +1.

PGlite tem uma conexão. O teste de corrida verifica conflito de versão pela API e serialização das transações no adaptador; **não mede contenção de locks entre conexões PostgreSQL independentes**. Isso exige Supabase/PostgreSQL real.

## Pendências honestas

| Gravidade | Pendência / reprodução |
|---|---|
| Bloqueio externo de homologação | Sem credenciais Supabase: Auth anônimo real, upgrade/e-mail/SMTP, Broadcast privado hospedado e concorrência com conexões independentes não executados. Rodar fluxo ao vivo antes do público. |
| Bloqueio editorial | 240 itens continuam provisórios; três ajustes iniciais documentados, revisão factual integral pendente. Catálogo oficial fica bloqueado por padrão. |
| Bloqueio externo de publicação | Nenhum deploy Vercel foi feito. Configurar projeto, variáveis e origem do Auth conforme README. |
| Marca | Rufing não incluída; fallback da especificação em uso. Webfont licenciada e naming/domínio precisam do responsável. |
| Operação antes do público | Configurar proteção por IP/CAPTCHA, retenção/expiração, alertas e SMTP. SQL rate limit não cobre tentativas que abortam. |
| Melhoria de conta | Não há formulário de recuperação de senha; autenticação por senha e upgrade existem, sem homologação SMTP. |
| Cobertura | Som com opt-in e CSS de movimento reduzido implementados, mas sem medição auditiva ou auditoria completa de acessibilidade. Autoria permanente testada no SQL, não em um fluxo SMTP de browser. |

Não há declaração de deploy, revisão factual completa ou certificação Supabase hospedada. O código executável, migration, seed e instruções estão entregues; o aceite público depende dessas verificações externas.
