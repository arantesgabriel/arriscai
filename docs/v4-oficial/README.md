# Integração oficial V4 · Fases 1 a 5

Implementação na branch `dev`, a partir de `8214235`, em 16/11/2026. Escopo autorizado pelo usuário: conectar todas as interfaces às rotas oficiais, sem merge ou deploy. Referência visual exclusiva: a landing V4 já implementada.

As telas novas fazem parte do `GameApp` de `/jogar`, `/sala/[id]` e dos convites/modo telão existentes. Criar sala, entrar, preparar, selecionar, revelar, julgar, avançar e reiniciar continuam usando os handlers e comandos existentes. Não há uma rota paralela de protótipo na experiência oficial.

## O que mudou

| Experiência | Implementação |
|---|---|
| Design system | Paleta V4 central, semântica de ação/seleção/revelação/recompensa/informação privada, fontes Changa One e Nunito Sans no layout, ligação dos tokens ao Tailwind |
| Entrada | Apelido compartilhado, criar/entrar separados, formulário Paper sobre Night, composição curta de cartas; retirados o hero antigo e a explicação repetida de regras |
| Lobby | Código destacado, participantes/papéis/presença, painel de sala escuro e preparação clara |
| Roleta | Paleta central V4, ponteiro Mint e anúncio sincronizado; vencedor/timestamp continuam vindo do backend |
| Preparação | Configuração em grupos, categorias de altura consistente com ícones vetoriais, resumo e ação de início agrupados |
| Biblioteca | Busca, filtros, paginação, seleção e prévia privada existentes recebem hierarquia e estados coerentes |
| Organizador desktop | Tabuleiro e mesa de operação em colunas simultâneas; pergunta privada, comando contextual, placar e gerenciamento possuem pesos distintos |
| Organizador mobile | Cabeçalho e placar compactos, painel contextual após o tabuleiro e consulta privada recolhível; removidas as duplicações de placar e painel privado abaixo da rodada |
| Tabuleiro | Cartas Paper, seleção Lilac com contorno Mint, revelação Mint e índice persistente; palavras em Nunito Sans com quebra; `aria-pressed` na seleção |
| Jogador | Turno, pontos e tabuleiro prioritários; placar compacto expansível no mobile e ranking lateral no desktop |
| Telão | Palco Night próprio, seis colunas em Full HD, turno e pontos ampliados, ranking lateral, sem controles de partida ou segredo |
| Resultado | Resposta e pergunta com hierarquia própria; resultado precede o tabuleiro na composição pública; avanço continua manual; rodada sem vencedor tem badge distinto |
| Pódio | Campeão Mint, recompensa Gold, pedestais Lilac/Gold/Mint e classificação; ícones originais agora usam tokens centrais |
| Conta/recuperação/áudio/histórico | Painéis e controles incorporam a identidade; comportamento de autenticação, callbacks, autoria e som opt-in preservado |

Não houve mudanças em RPC, estado transacional, pontuação, reservas, desempate, migrations, RLS, Supabase Auth ou autorização.

## Arquivos e organização

- `src/app/layout.tsx` e `src/app/page.tsx`: fontes centralizadas e retirada do carregamento duplicado da fonte Changa One na home.
- `src/app/globals.css`: hub de imports e margem global mínima, substituindo 2.064 linhas de regras globais de interface.
- `src/styles/game/legacy.css`: regras de compatibilidade restritas a `.app`, sem imports externos de fontes. Essa camada conserva estruturas ainda usadas; não se afirma que todo o legado foi eliminado.
- `src/styles/game/shell.css`, `lobby.css`, `play.css`, `results.css`: composição e estados por experiência.
- `src/styles/tokens.css`, `typography.css`, `theme.css`: sistema compartilhado, fontes e mapeamento Tailwind.
- `src/components/game/entry-screen.tsx`, `board.tsx`, `game-icon.tsx`, `host-roulette.tsx`, `score-strip.tsx`, `results.tsx`: componentes visuais extraídos.
- `src/components/game-app.tsx`: mantém estado, callbacks e sincronização; passou de 2.432 para cerca de 1.843 linhas.
- `src/components/ui/Surface.module.css`, `Tile.module.css` e `src/app/design-system/page.module.css`: ajustes dos componentes-base e sua página para os novos papéis.
- `tests/e2e/staging-guard.ts`: inspeciona todos os chunks de `/jogar` para confirmar o backend exato antes de autenticar. A extração dos componentes tornou insuficiente procurar apenas `app/page.js`.
- `tests/e2e/game.spec.ts` e `staging-states.spec.ts`: espera pelo título exato do lobby. A nova entrada também contém “Junte a galera.”; correspondência parcial fazia o teste avançar antes da navegação.
- `DESIGN.md`: decisões da identidade oficial atualizadas.

Os arquivos da landing em `src/components/landing/` não foram editados.

## Evidências

- [Galeria das interfaces oficiais](galeria.html).
- [Manifesto do fluxo real](resultados.json).
- [Comparação estática da landing](landing-comparison/resultados.json).
- [Enquadramento final do resultado no telão](telao-final.json): 1920×1080, `scrollHeight=1080`, resposta visível e tabuleiro recolhido visualmente durante o resultado.
- [Registro do limite de offline seguido imediatamente de reload](limite-offline-reload.json).

As capturas de `capturas/` são do frontend oficial local em `http://127.0.0.1:3018`, ligado ao backend hospedado `arriscai-dev` (`ksouiyjszsfrqrurpepq`). Não são capturas de um novo deploy. O roteiro verifica a URL efetivamente embutida no cliente antes de criar sessões; nenhum mock ou transporte interceptado foi usado nesse fluxo.

Foram utilizados organizador, três jogadores e telão em cinco BrowserContexts independentes. O fluxo percorreu sala, biblioteca, roleta, tabuleiro de 22 palavras, seleção, revelação, erro, turno, pausa, retomada, retorno online, acerto, resultado público, 22 revelações/desistências até uma rodada sem vencedor, pódio e nova partida. A nova partida foi confirmada com 12 palavras, respeitando sua configuração, em vez de presumir que teria sempre 22.

O manifesto registra 74 capturas de fluxo e cinco capturas diagnósticas de uma tentativa intermediária. Há ainda três capturas finais de resultado após a organização dos componentes e o ajuste do telão, totalizando 77 imagens oficiais na galeria. A execução foi retomada para concluir a confirmação da nova partida, seleção por teclado com movimento reduzido e reflow em viewport menor; `previousAssertionFailure` preserva a asserção incorreta de 22 palavras. A galeria separa diagnósticos das capturas de aceitação.

Os seis tamanhos exatos foram usados em entrada, lobby do host, host/jogador ativos, resultado e pódio do host: 320×720, 390×844, 768×1024, 1360×768, 1440×900 e 1920×1080. Outros estados têm dimensões individuais registradas no manifesto. Não foi detectado overflow horizontal nas capturas medidas. O input de palpite também foi capturado em 320×720 e 390×500.

Os vídeos locais ficam em `.tmp/v4-oficial/videos/`; capturas e relatórios ficam versionados. Os arquivos de sessão com credenciais estão somente em `.tmp/v4-oficial/sessions/`, ignorados pelo Git, e não fazem parte do commit.

## Landing preservada

A comparação usou a revisão anterior `8214235` em um servidor separado e o código integrado, nos seis viewports. As imagens PNG ficaram **idênticas byte a byte em 6 de 6 tamanhos**, com as mesmas alturas, fontes computadas e larguras.

Essa comparação é da renderização estática, com JavaScript desabilitado e movimento reduzido. Requisições a Google Fonts externas foram bloqueadas nos dois lados; as fontes locais fornecidas por `next/font` foram carregadas. Os testes de animação e interações da landing foram executados separadamente com JavaScript ativo. O CSS, textos e componentes da landing permanecem sem alterações.

## Testes

| Verificação | Resultado |
|---|---|
| Typecheck | Passou após corrigir a importação do tipo Member na extração |
| Build | Passou, Next.js 16.4.6 / Webpack; nenhum deploy |
| Lint | Passou; repetição final após organização dos arquivos |
| Unitários | 17 testes em 2 arquivos passaram |
| Playwright isolado final | 11 passaram e 1 staging foi ignorado por configuração, duração 1,4 min; inclui jogo completo, sigilo, autorização, concorrência, pontos, resultados, nova partida e landing |
| Playwright staging-states live | 1 passou, 26,3 s: identidade sob latência, UID persistido, roleta, participantes, duplicata de apelido, movimento reduzido e reconexão |
| Roteiro real de cinco sessões | Fluxo concluído com retomada documentada; zero pageerrors e zero erros de console no manifesto de conclusão |
| Comparação estática da landing | PNGs idênticos em 320, 390, 768, 1360, 1440 e 1920 px |

Os 28 testes SQL e o teste de upgrade de migrations passaram na auditoria de referência da Fase 0. Nenhum SQL foi alterado nesta integração. Não são apresentados como uma nova certificação do banco hospedado.

## Interrupções e limites para homologação

O disco atingiu ENOSPC durante gravações intermediárias, inclusive ao salvar vídeos de uma execução live de `game.spec.ts`. Essa execução não foi contada como aprovada. Foram removidos somente caches e vídeos intermediários produzidos por este trabalho; os arquivos prévios do usuário e os vídeos finais referenciados pela Fase 0 foram preservados.

O teste live de staging inicialmente consultava o membro antes do término da navegação por causa de uma correspondência parcial no título. Após corrigir a espera para o título exato, passou. O guard de staging também foi atualizado para a divisão real dos chunks, sem relaxar a checagem do project ref.

O cenário que faz offline, volta online e imediatamente recarrega a página ficou em “Conectando à sala” em uma execução local. A evidência foi preservada. O fluxo final verificou a recuperação do canal online sem reload, e o E2E isolado cobre reload normal. **O reload imediatamente após offline no ambiente hospedado ainda exige homologação específica**; não foi declarado resolvido nem foram alterados protocolos de autenticação para contornar o teste.

Não houve aparelho físico, teclado virtual real, zoom nativo de 200%, leitor de tela ou certificação integral WCAG 2.2 AA. A captura de 720×450 é evidência de reflow, não prova de zoom nativo. Conta permanente, confirmação por e-mail, recuperação enviada e edição real de perguntas próprias ainda dependem de conta/caixa de teste. Os painéis foram abertos, e autenticação e autorização existentes foram preservadas.

O mobile conserva rolagem vertical, especialmente em 320×720, perguntas extensas e preparação. O painel contextual está no fluxo, sem sobrepor palavras ou campos. A escolha de não adicionar uma barra fixa nesta integração evita ocultar o tabuleiro; seu refinamento com teclado físico/virtual pertence à homologação mobile.

Nenhum merge, push ou deploy foi realizado. A Fase 6 e a liberação para produção permanecem sujeitas à aprovação do usuário.
