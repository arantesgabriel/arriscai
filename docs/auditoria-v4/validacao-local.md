# Validação de referência · Fase 0

> Privacidade do catálogo (18/11/2026): esta cópia histórica teve enunciados, respostas, arquivos de dados e capturas removidos. Resultados anteriores foram preservados como histórico, não como nova homologação; instruções de catálogo devem seguir `docs/CONTEUDO.md`.

Executada em 16/11/2026 sobre `dev`, HEAD inicial `7cf6bce`. Não houve implementação no frontend.

| Comando | Resultado |
|---|---|
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0, Next 16.4.6 Webpack; rotas `/`, `/jogar`, `/sala/[id]`, `/design-system` geradas |
| `npm test` | 2 arquivos, 17 testes passaram |
| `npm run test:db` | 28 verificações SQL passaram em PGlite isolado |
| `npm run test:migrations` | Upgrade e backfill passaram no banco local de teste |
| `npm run test:e2e` | 11 passaram, 1 ignorado, duração 2,2 min |
| `node scripts/audit-v4.mjs` | Fluxo real em produção concluído, cinco sessões, 70 capturas, zero pageerrors/console errors |
| `node scripts/render-audit-v4.mjs` | 11 renderizações de mockups, sem overflow horizontal e com as duas fontes carregadas |

Ambiente da execução E2E bem-sucedida:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='C:/Users/Gabriel/AppData/Local/ms-playwright'
$env:ARRISCAI_E2E_PORT='3016'
$env:ARRISCAI_BUILD_DIR='.tmp/audit-v4/next-e2e'
npm run test:e2e
```

O servidor do usuário em `127.0.0.1:3000` foi preservado. A primeira tentativa da suíte em 3016 sem distDir isolado foi recusada pelo lock do Next. Repetir com `ARRISCAI_BUILD_DIR` resolveu sem encerrar o servidor existente. Arquivos de configuração reescritos automaticamente pelo Next durante os testes foram restaurados ao conteúdo original depois da execução.

Testes E2E executados:

1. `game.spec.ts`: três jogadores, telão e espectador tardio; comandos concorrentes, sigilo de snapshot, autorização privada, 22 palavras, pontuação, avanço, sem acerto, nova partida, cancelamento, troca de host e pergunta de nove palavras. SQL real em PGlite com Auth e transporte Realtime simulados.
2. `landing.spec.ts`: layout e interações em 320, 390, 768, 1360, 1440 e 1920 px.
3. `landing.spec.ts`: metadados, teclado, movimento reduzido e ausência de JavaScript.
4. `landing.spec.ts`: animações originais e feedback de scroll.
5. `landing.spec.ts`: estado final das ilustrações animadas.
6. `landing.spec.ts`: sequência mobile por visibilidade e término do card anterior.

**Ignorado:** `staging-states.spec.ts`, por ausência de `ARRISCAI_LIVE_E2E=1` e referência/chaves de staging correspondentes. Não foi homologado implicitamente pela passagem dos outros testes.

Limites de execução: na primeira tentativa unitária, o sandbox bloqueou o rename de temporários antes da coleta; o mesmo comando fora do sandbox passou com 17 testes. Na auditoria de produção, tentativas intermediárias pararam por seletores/textos diferentes do esperado pelo roteiro. Os seletores foram corrigidos e a execução final completa está em `resultados.json`; essas interrupções não foram classificadas como bugs do aplicativo.

O relatório HTML detalhado dos testes locais está em `playwright-report/index.html` (ignorado pelo Git). Evidências adicionais do harness estão em `.tmp/qa-evidence/`. Os vídeos reais da produção estão em `.tmp/audit-v4/videos/`; os mockups e capturas atuais estão em `docs/auditoria-v4/` e são versionados.

Esta bateria estabelece a referência atual. Não representa validação de uma refatoração implementada, nem certificação completa de acessibilidade, autenticação hospedada ou todos os dispositivos físicos.
