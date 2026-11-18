# Correções da homologação B01–B04

> Privacidade do catálogo (18/11/2026): esta cópia histórica teve enunciados, respostas, arquivos de dados e capturas removidos. Resultados anteriores foram preservados como histórico, não como nova homologação; instruções de catálogo devem seguir `docs/CONTEUDO.md`.

Trabalho iniciado em 17/11 e concluído na sessão de 18/11/2026, na branch `dev`, conforme instrução do responsável. Base: `132c1250b1e9c31eb0f8dbcc73693ce67e1f1ef0`. Os relatórios e o ZIP da auditoria anterior já estavam sem rastreamento e foram preservados, sem incorporá-los aos commits deste trabalho.

**Parecer: correções implementadas e verificadas localmente; ainda não certificadas no Supabase hospedado e não publicadas.** Não declarar a aplicação inteira homologada nem a produção corrigida. O acesso de banco de homologação foi bloqueado por DNS/TLS; nenhuma migration foi aplicada remotamente. Não houve push, merge ou deploy.

Código e testes commitados em `870c5d071e898a19374ea48173474f9823d1ad8b` (`fix: corrige ressalvas B01-B04 da homologacao`). Evidências e instruções são entregues em commit documental separado.

## Correções

| ID | Mudança | Evidência e alcance |
|---|---|---|
| B01 | O placar dentro do pódio usa superfície noturna com título, nomes e posições claros; pontos dourados e posição atual em menta. | Seis análises axe de placares: host/jogador/telão, ativo/pódio. Contrastes calculados de 14,17:1 (papel), 10,59:1 (dourado) e 11,60:1 (menta) sobre `#1e2144`. Capturas reais do build local nas sete resoluções. |
| B02 | Placar mobile em uma linha com rolagem horizontal e classificação completa disponível. Painel de operação antes do tabuleiro; seleção transfere foco à confirmação e comparação transfere foco ao julgamento. Botão para retornar ao tabuleiro. | Rodadas mobile inteiras com 22 revelações, posição 22 primeiro, em 320×720 com três jogadores e 390×844 com cinco. Confirmação fica na viewport após seleção, sem rolagem manual adicional. Consulta secreta abre/fecha. Palavras de até 13 caracteres nos enunciados jogados. |
| B03 | Migration incremental aloca apelidos disponíveis para telões sob a trava da sala, preservando identidades e unicidade de jogadores. | Dois contextos de telão entram juntos como `Telão` e `Telão 2`. SQL local testa apelido de jogador ocupado, reconexão e nome de 24 caracteres. Exclusão dos telões do rodízio e preservação como espectadores na nova partida. Concorrência hospedada pendente. |
| B04 | Q0710 passa a “[enunciado omitido por privacidade]?”. | 11 palavras, resposta `[resposta omitida]`, alias `[alias omitido]`. Dados atuais de 240/504 questões, seed e ranking atualizados. Arquivo `perguntas_240_original.json` e migrations históricas preservados. Migration específica corrige registro existente com guarda editorial, sem alterar aprovação. |

O novo enunciado especifica a eletrosfera, em vez de apenas carga negativa. As fontes e o conteúdo editorial são mantidos no processo privado do catálogo. O formato de armazenamento continua sem `?`, acrescentado pelo cliente. Não foram adicionados aliases de partículas diferentes nem alterada a autoridade do julgamento humano.

## Regressão funcional local

O teste `tests/e2e/homologation-fixes.spec.ts` executa o **frontend compilado de produção, servido localmente**, com Chromium e o adaptador de testes existente. O banco é PGlite; Auth e transporte Phoenix/Realtime são simulados. Não é produção nem comprovação do Supabase hospedado.

- Organizador, três jogadores e dois telões em seis contextos independentes; mais duas identidades para a rodada com cinco jogadores.
- Partida de quatro rodadas com +22, +19, +1 e zero; acumulado, vencedor e histórico conferidos.
- Nova partida com pontos zerados, empate, primeira extra sem vencedor e segunda extra decisiva.
- Julgamentos repetidos com mesma chave em chamadas concorrentes: versão aumenta uma vez e pontos são atribuídos uma vez. Sem alterar throttle, regras ou pontuação; o teste aguarda a janela real de limitação de comandos entre partidas.
- Reload de telão, jogador e organizador, ciclo offline/online de jogador, preservação do estado, telões sincronizados e fora do rodízio na partida seguinte.
- Rodadas completas em mobile pelos controles reais, incluindo seleção inferior do tabuleiro, confirmação explícita, palpite, comparação, consulta secreta e julgamento humano.

As capturas cobrem **320×720, 390×844, 430×932, 768×1024, 1360×768, 1440×900 e 1920×1080**, para organizador, jogador e telão em rodada ativa e pódio. O teste verifica ausência de overflow horizontal do documento. Há rolagem vertical para consultar todas as posições e todos os resultados; não se afirma que tudo cabe simultaneamente na tela.

O painel mobile usa o fluxo normal, sem controles fixos ou sticky adicionais; não sobrepõe posições ou inputs. O placar horizontal aceita foco de teclado e mantém a classificação completa disponível. O foco programático não abre o teclado: vai para título ou grupo de julgamento. Foram exercitados `prefers-reduced-motion: reduce` e alvos de toque existentes. Teclado virtual físico, leitores de tela e ordem completa de navegação assistiva não foram homologados.

Para reproduzir a regressão compilada em PowerShell, com dependências instaladas:

```powershell
$env:ARRISCAI_BUILD_DIR='.tmp/build-homologation'
npm run build
$env:ARRISCAI_E2E_PRODUCTION='1'
$env:ARRISCAI_E2E_PORT='3040'
$env:PW_REUSE_SERVER='0'
npx playwright test tests/e2e/homologation-fixes.spec.ts --output=.tmp/results-fixes-current
```

Esse teste sempre usa o adaptador local, mesmo se `.env.local` contiver endpoint hospedado. Não habilita execução live por variável de ambiente. As imagens e os JSON são gravados no diretório desta correção; para uma auditoria futura, ajustar o destino para um novo diretório antes de executar e preservar este conjunto.

## Evidências

- [Regressão e contexto](evidencias/regression.json), [log E2E final](evidencias/e2e-final.txt).
- [axe dos placares](evidencias/axe.json), [contrastes calculados](evidencias/contrast.json). O axe tem escopo `.scoreboard`; não constitui certificação integral WCAG.
- Telão no pódio, 1920×1080 (captura retirada por privacidade).
- Confirmação da posição 22 em 320×720 (captura retirada por privacidade), julgamento em 320×720 (captura retirada por privacidade).
- Cinco jogadores em 390×844 (captura retirada por privacidade), confirmação da posição 22 em 390×844 (captura retirada por privacidade).
- Baseline visual preservado nos arquivos fornecidos em `docs/homologacao-final-2026-11-17/evidencias/screenshots/`: `partida-2-podio-telao.png`, `mobile-22-controles-abaixo.png` e demais referências do relatório anterior. As novas capturas não sobrescrevem essas evidências.

`evidencias/revision.json` identifica o commit da validação histórica. O manifesto e as capturas originais foram retirados por privacidade; os resumos de resultados não contêm o catálogo.

## Checks e incidentes de execução

| Check | Resultado |
|---|---|
| `npm run typecheck` | Passou |
| `npm test` | 22 testes em cinco arquivos passaram |
| `npm run test:db` | 28 checks passaram; saída redirecionada para o novo diretório |
| `npm run test:migrations` | Passou, incluindo upgrade de Q0710 antiga/aprovada e preservação de histórico/empates |
| `node scripts/test-homologation-fixes.mjs` | Passou, incluindo guardas editoriais e apelidos |
| `npm run build` | Passou; fontes obtidas com acesso de rede autorizado |
| E2E compilado | Passou; detalhes no log final |
| ESLint de `src`, `tests`, `scripts` e configuração Playwright | Passou |
| `npm run lint` completo | Falha preexistente: três usos de `require()` no `worker.cjs` arquivado da auditoria fornecida. Snapshot preservado; nenhuma regra foi relaxada ou arquivo antigo alterado para esconder a falha. |

As primeiras tentativas tiveram restrição de sockets no sandbox, seletores de teste incompatíveis com a seta do botão e o layout do telão, recargas durante execução em dev e `ENOSPC`. Os seletores foram corrigidos; a regressão final roda sobre `next start`, sem build concorrente. Somente artefatos temporários criados por esta execução foram removidos para liberar espaço, com caminhos conferidos. Alterações incidentais em `tsconfig.json` e `next-env.d.ts` foram revertidas ao conteúdo original. Logs de tentativas anteriores foram mantidos separadamente e não são evidência de aprovação.

`axe-core` foi declarado diretamente como dependência de desenvolvimento, reutilizando a versão já presente no lockfile, para tornar a nova validação reproduzível.

## Banco e publicação

Ver [instruções de aplicação e testes](APLICACAO_SQL.md). As migrations `202611170006` e `202611170007` estão preparadas e **não foram aplicadas por este trabalho nos serviços hospedados**; a conferência remota do histórico também permanece pendente. O projeto dev identificado na configuração e na documentação é `ksouiyjszsfrqrurpepq`. Tentativas somente de leitura falharam com `ENOTFOUND` na conexão direta e `SELF_SIGNED_CERT_IN_CHAIN` no pooler, inclusive com certificados do sistema. Não foram desabilitadas verificações TLS, executadas partidas remotas ou alteradas configurações do Supabase.

**Corrigido no código e testado localmente** é diferente de **validado em homologação hospedada**, que permanece pendente, e de **publicado e validado em produção**, que não ocorreu.

## Limitações preservadas

Manual/misto e biblioteca continuam desativados. Não foram criados logout, reversão de julgamento ou outros fluxos fora do escopo. Permanecem sem homologação completa: conta permanente, entrega de e-mail/recuperação, Firefox/WebKit, teclado virtual físico, expiração de JWT, ensaio de várias horas e avaliação integral WCAG. Não houve revisão editorial integral do catálogo.

A correção está pronta para revisão e homologação hospedada, com as evidências locais descritas. **“Sem ressalvas” ainda não pode ser emitido para o serviço publicado**: falta acesso TLS confiável ao dev, aplicar e testar as migrations nesse ambiente e, em trabalho posteriormente autorizado, publicar e verificar produção. O lint completo também permanece com a falha do arquivo histórico fornecido.
