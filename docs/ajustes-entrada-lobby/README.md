# Entrada e lobby · ajustes solicitados

> Privacidade do catálogo (18/11/2026): esta cópia histórica teve enunciados, respostas, arquivos de dados e capturas removidos. Resultados anteriores foram preservados como histórico, não como nova homologação; instruções de catálogo devem seguir `docs/CONTEUDO.md`.

Implementados na branch `dev`, sobre `247592b`. Referência: telas oficiais existentes e os três anexos fornecidos pelo usuário. Sem merge, push ou deploy.

## Comportamento

- Entrada centralizada na área disponível entre cabeçalho e rodapé.
- Footer fixo na parte inferior. A área central possui rolagem própria e termina antes do footer; campos e controles permanecem alcançáveis.
- “Criar sala” e “Tenho um código” se alternam. Apenas a opção aberta apresenta campos e CTA. O apelido é preservado ao alternar.
- Ao abrir um convite com `codigo`, a opção de código já vem expandida e preenchida; criar sala fica recolhido. O mesmo vale para a entrada no telão.
- Card “Na sala” com código compacto, contagem de participantes, nomes/papéis e avatares circulares de 30 px.
- Sorteio e escolha manual ficam em uma seção opcional recolhida. O criador continua como organizador inicial. Durante um sorteio real, a seção abre para apresentar o evento sincronizado.
- Preparação visível também aos jogadores, em modo somente leitura: rodadas, tamanho, categorias, modo, disponibilidade e quantidade selecionada. Participantes que entram depois recebem a prévia atual; a troca de organizador atualiza quem pode editar.
- Enunciados, respostas, IDs das perguntas e busca privada não são compartilhados com os jogadores.

## Sincronização

A prévia usa metadados públicos no canal de presença já existente da sala, com atualização agrupada em 180 ms. É uma prévia temporária de interface; não substitui o estado transacional da partida. O payload é limitado a opções e contagens, validado na leitura e associado ao organizador atual. Não são usados esses dados para autorizar ações ou executar `prepare_match`.

O catálogo, a biblioteca, a seleção das perguntas e seus IDs permanecem apenas no navegador do organizador e nos RPCs já existentes. Não houve alteração de migrations, RLS, autenticação, pontuação ou comandos de partida.

## Capturas atuais

As imagens são do frontend oficial local em `127.0.0.1:3018`, conectado ao Supabase dev hospedado, em sessões independentes. Não são mockups nem capturas de um deploy novo.

| Entrada | Sala do jogador |
|---|---|
| Criar sala (captura retirada por privacidade) | Preparação somente leitura (captura retirada por privacidade) |

- Entrar por código, desktop (captura retirada por privacidade).
- Card do organizador e preparação (captura retirada por privacidade).
- Entrada mobile, início do conteúdo (captura retirada por privacidade).
- Campo de código alcançado por Tab em 320×720 (captura retirada por privacidade).
- Sala do jogador no celular (captura retirada por privacidade).
- Antes: entrada (captura retirada por privacidade) e lobby (captura retirada por privacidade).

## Validação executada

| Verificação | Resultado |
|---|---|
| Lint | Passou |
| Typecheck | Passou |
| Build Webpack | Passou |
| Unitários | 19 testes passaram; inclui validação e remoção de campos privados da prévia |
| Suíte E2E local isolada | 12 passaram; 1 teste de staging ignorado nessa execução |
| E2E no Supabase dev real | 2 passaram: entrada/lobby/preparação e identidade/roleta/reconexão |
| Checagem adicional real de teclado em 320×720 | Passou: Tab alcança o campo de código, que permanece acima do footer |

Viewports exatos: 320×720, 390×844, 768×1024, 1360×768, 1440×900 e 1920×1080. As verificações mediram ausência de overflow horizontal, posição do footer e limite inferior da área central. Foram exercitados os dois modos de entrada, convite preenchido, preservação do apelido, atualização de opções e contagens, chegada tardia e transferência de organização. Os controles públicos foram verificados como desabilitados e o enunciado selecionado não apareceu no card público.

O teste do transporte local passou a preservar metadados e renovar a referência de presença em atualizações. A sincronização também foi validada no Supabase hospedado; a aprovação não depende somente do harness.

Os viewports foram emulados em Chromium e o teclado usado foi o de automação. Não houve teste em aparelho físico ou teclado virtual real nesta alteração.

## Arquivos principais

- `src/components/game/entry-screen.tsx`: formulários alternáveis.
- `src/components/game/host-roulette.tsx`: sorteio opcional recolhível.
- `src/components/game/preparation-preview.tsx`: visualização pública bloqueada para edição.
- `src/components/game/category-metadata.ts`: ícones e nomes compartilhados entre as duas vistas.
- `src/lib/preparation.ts`: contrato público e validação da prévia.
- `src/components/game-app.tsx`: seleção inicial por convite, publicação/recebimento da prévia e participantes compactos.
- `src/styles/game/shell.css` e `lobby.css`: centralização, rodapé, rolagem e composição dos cards.
- `tests/e2e/lobby-ui.spec.ts`, `staging-states.spec.ts`, `game.spec.ts`, `sql-harness.ts` e `tests/preparation.test.ts`: cobertura das interações e regressão.

Os arquivos da landing V4 permaneceram sem alterações.
