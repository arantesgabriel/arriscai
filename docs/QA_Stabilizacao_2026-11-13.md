# Arriscaí — estabilização e auditoria QA

| Campo | Valor |
| --- | --- |
| Data | 13/11/2026 |
| Ambiente | Windows, Node.js 24.21.0, npm 12.2.1, Next.js 16.4.6 |
| Branch | `dev`, upstream `origin/dev` |
| Commit base | `91e6db8527dbbe2eb377776e3386167c04d1a070` |
| Estado | alterações locais; nenhuma publicação feita |

## Inventário e decisão

- As branches locais `dev` e `main`, e as referências visíveis `origin/dev` e `origin/main`, apontavam para `91e6db8` durante a inspeção. Isso não comprova qual branch ou banco está ligado à produção.
- O documento `docs/DEPLOY.md` contém afirmações históricas contraditórias sobre Vercel/Supabase. Não há CLI Vercel disponível e o estado live não foi verificado por API nesta execução. URLs e deploys descritos ali ficam **não verificados**.
- `.env.local` aponta para um projeto Supabase hospedado, mas seu project ref não aparece no inventário disponível do Supabase CLI. Sem identificar o ambiente, não é possível afirmar que seja staging ou produção.
- A captura enviada mostra placar acumulado 8, `round_points` igual a 0 e sem resposta no resultado. Isso coincide com a função SQL da migration `202611130001_game.sql`, que soma os pontos do jogador mas não grava `round_points` nem `answer`; é forte indício de que o banco live ainda usa essa função antiga. Não foi possível confirmar o estado remoto.
- Não houve deploy, alteração de configuração live, seed, aprovação/exclusão de perguntas, alteração de usuários nem migration aplicada em banco hospedado.
- **Decisão:** não aprovar publicação. A homologação real de staging permanece pendente e a auditoria completa de dependências ainda acusa vulnerabilidades moderadas de desenvolvimento.

## Correções implementadas

- A resposta só entra na projeção pública depois de a rodada terminar; o snapshot não contém aliases nem perguntas futuras. A resposta exibida pertence à rodada encerrada.
- O resultado mostra pergunta completa, solução, acertador e pontos conquistados. O Board troca “pontos em jogo” por “pontos conquistados” ou “sem vencedor”.
- Cancelar uma partida habilita espectadores tardios para a próxima, mantendo o telão como `display_only`.
- A roleta sincroniza a seleção entre clientes, mantém escolha manual e não permite trocar organizador no meio da partida.
- O preview privado de resposta exige organizador e sala fora de partida ativa. As ações móveis do host ficam sticky durante a jogada; o overlay de resultado não é coberto por esse dock.
- O histórico recebeu migration incremental. Ela preenche vencedor único, organizador e total de rodadas a partir dos scores e do log de ações quando há evidência; empates antigos permanecem sem vencedor.
- O harness E2E agora substitui chamadas Supabase hospedadas pelo adaptador local por padrão. O modo live exige HTTPS e project ref de staging explicitamente coincidente.

## PASS

- `npm ci` — concluído.
- `npm run lint` — passou.
- `npm run typecheck` — passou.
- `npm test` — 14 testes unitários passaram.
- `npm run test:db` — 28 verificações SQL/RLS passaram em PGlite; Auth e Realtime são simulados. A nova regressão usa a pergunta de 9 palavras do Tour de France e confirma 8 pontos após duas reveladas.
- `npm run test:migrations` — upgrade desde o schema anterior validou vencedor único, empate preservado, organizador e número de rodadas.
- `npm run test:e2e` — 1 cenário passou com três jogadores, host, telão e espectador tardio no harness local. Cobriu pontuação 22/19/1, a pergunta de 9 palavras exibindo 8 no Board/resultado/placar/pódio, rotação, confirmação antes da revelação, resposta oculta antes do resultado, reconexão por reload, corrida de seleção (um sucesso e um conflito), telão somente leitura e elegibilidade após cancelamento.
- `npm run build` — build Webpack de produção passou.
- `npm audit --omit=dev --audit-level=moderate` — zero vulnerabilidades nas dependências de runtime.
- `git diff --check` — passou.
- Evidência local: 85 capturas entre 390/768/1440/1920 e sete vídeos nomeados por papel/fluxo em `.tmp/qa-evidence/`.

## FAIL / risco que exige atenção

- `npm audit` completo aponta **7 vulnerabilidades moderadas**, todas na árvore de desenvolvimento (`typescript-eslint` e `minimatch`), sem vulnerabilidades de runtime. `npm audit fix` não alterou a árvore e os avisos persistiram; não foi aplicado override de major sem compatibilidade comprovada.
- Uma tentativa E2E anterior, antes do isolamento do harness, usou o endpoint hospedado configurado em `.env.local`: `create_room` e `join_room` responderam 200. Isso criou uma sala de teste e uma associação de participante no projeto de ref `ksouiyjszsfrqrurpepq`. A partida não foi iniciada. Como o ambiente não foi identificado e há proibição de apagar dados live sem autorização, **não fiz limpeza remota**. O código/ID da sala não foi preservado; localize a sala pelo horário da execução e pelos nomes fictícios do cenário, caso decida removê-la.

## SKIP / pendências de homologação

- Verificar no Supabase hospedado `review_status`, `allow_provisional`, disponibilidade do catálogo e configuração de seed; o projeto configurado não pôde ser confirmado como staging.
- E2E hospedado com JWT real, REST/RLS real, Realtime real, concorrência entre clientes reais, host offline, reconexão de rede e perda de sessão.
- Confirmar captura/vídeo de todos os fluxos em staging e publicar links de staging/produção somente após deploy real. Os artefatos desta execução são do harness local.
- Revisão editorial/aprovação do catálogo de perguntas. Nenhuma questão provisória foi habilitada nem aprovada.

## Evidências visuais locais

- [Host — resultado em 390 px](../.tmp/qa-evidence/screenshots/host-round-result-390.png)
- [Jogador — resultado em 390 px](../.tmp/qa-evidence/screenshots/player-a-round-result-390.png)
- [Telão — resultado em 390 px](../.tmp/qa-evidence/screenshots/tv-round-result-390.png)
- [Pergunta Tour de France — resultado 8 pontos em 390 px](../.tmp/qa-evidence/screenshots/tour-de-france-host-result-390.png)
- [Vídeo do host](../.tmp/qa-evidence/videos/host.webm)
- [Vídeo do jogador A](../.tmp/qa-evidence/videos/player-a.webm)
- [Vídeo do jogador B](../.tmp/qa-evidence/videos/player-b.webm)
- [Vídeo do jogador C](../.tmp/qa-evidence/videos/player-c.webm)
- [Vídeo do telão](../.tmp/qa-evidence/videos/telao.webm)
- [Vídeo do espectador tardio](../.tmp/qa-evidence/videos/late-spectator.webm)
- [Vídeo de cancelamento com espectador tardio](../.tmp/qa-evidence/videos/cancel-late-spectator.webm)
