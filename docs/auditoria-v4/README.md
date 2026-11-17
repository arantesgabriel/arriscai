# Arriscaí! · Auditoria e proposta V4

Fase 0, realizada em 16/11/2026. Referência visual exclusiva: a landing já implementada e publicada em https://arriscai.vercel.app/. Nenhuma alteração em `src/`, regras, RPCs, migrations, RLS ou autenticação faz parte desta entrega. Os mockups são documentos isolados, com dados ilustrativos, sem conexão com Supabase. Não houve merge, push ou deploy.

## Entrega para aprovação

- [Mockups navegáveis](proposta.html): entrada, sala/preparação, organizador, jogador, telão, acerto e pódio. A navegação troca a proposta exibida; os botões de partida são apenas ilustrações.
- [Galeria de evidências e propostas](galeria.html).
- [Resultados brutos da produção](resultados.json): 70 capturas, dimensões, overflow e erros capturados na execução concluída.
- [Resultados de renderização dos mockups](mockups/resultados.json).
- [Roteiro reproduzível de auditoria](../../scripts/audit-v4.mjs).
- [Roteiro de renderização dos mockups](../../scripts/render-audit-v4.mjs).

**Decisão solicitada:** aprovar a direção visual e a proposta de design system para começar somente a Fase 1. Fases 2 a 6 continuam dependendo de aprovação separada.

## Revisões e origem das evidências

| Item | Evidência |
|---|---|
| Branch local | `dev` |
| HEAD inspecionado | `7cf6bceb81408fbe866357c705687b308e0afede` |
| `dev` remoto consultado | Mesmo SHA do HEAD local |
| `main` remoto consultado | `6442b20b1e601c28806a157f23637d39cc3e2f45` |
| Status Vercel de `main` | `success`, “Deployment has completed”, atualizado em 16/11/2026 às 17:01:45 de Brasília |
| Registro público do deploy | https://vercel.com/arantesgabriels-projects/arriscai/E3vqspGksvk91Hw8k1j4xEMZyYbV |
| Produção efetivamente aberta | https://arriscai.vercel.app/ |
| Sala da execução concluída | `4107BDD5`, UUID `be1cbca5-3d9a-4990-8baf-7cd495656849` |
| Conteúdo anterior do workspace | `debug.log` e `supabase/.temp/` já estavam sem rastreamento; preservados |

O domínio respondeu com `Server: Vercel`, mas não expôs SHA. A API pública de deployments do GitHub retornou uma lista vazia; a associação ao commit acima vem do status Vercel de `main`. Sem consultar o vínculo autenticado do alias na Vercel, o SHA exato atendido pelo domínio não pode ser certificado de forma independente. Por isso as capturas são a fonte da análise da produção, e o HEAD local é identificado separadamente. Não foram utilizadas capturas antigas como evidência atual.

Foram abertas sessões reais no navegador. O fluxo automatizado usou cinco BrowserContexts independentes: um organizador, três jogadores e um telão. Não houve interceptação de rede, mock, chamada direta de RPC, alteração SQL ou acesso a credenciais no roteiro da produção. O roteiro opera pelos controles visíveis. Uma sala inicial e duas tentativas intermediárias também foram criadas; as sessões foram fechadas ao final. Os dados de teste em produção não foram apagados.

## Diagnóstico

O aplicativo preserva uma identidade azul-clara/amarela com a fonte Lilita One. A landing apresenta cenário Night, fonte Changa One, CTA em menta, cartas Paper e contraste em lilás. A mudança acontece imediatamente ao clicar em “Jogar grátis”. É uma ruptura de produto, não apenas um problema de cor.

| Prioridade | Problema observado | Consequência | Direção proposta |
|---|---|---|---|
| Alta | `/jogar` repete hero, ilustração e explicação de três passos | A entrada exige leitura de marketing depois da decisão de jogar | Um apelido compartilhado e duas ações claras: criar ou entrar |
| Alta | Host 1440×900: tabuleiro de 22 palavras e controles ocupam uma página maior que a viewport | Confirmação e registro do palpite ficam abaixo das pistas | Tabuleiro à esquerda e operação completa à direita |
| Alta | Host mobile: código, convite e placar vêm antes do tabuleiro; há outro placar e outra pergunta privada abaixo | Distância entre leitura e ação, muita repetição | Cabeçalho compacto, um placar e painel contextual junto ao tabuleiro |
| Alta | Seleção e revelação atuais compartilham amarelo | Aguardando confirmação e palavra já pública dependem de outros sinais | Seleção lilás com contorno menta; revelação menta com número persistente e texto |
| Média | Lobby mistura convite, participantes, roleta e um formulário extenso | Preparação fica especialmente longa em 320/390 px | Compartilhamento e presença agrupados; configuração resumida e biblioteca sob demanda |
| Média | Categorias exibem “30 itens · 6 de 22 palavras” em todos os cartões | Texto repetitivo disputa espaço com os nomes | Nome e ícone por categoria; contagem agregada no resumo |
| Média | Placar compacto e placar completo aparecem simultaneamente no desktop/telão | Informação duplicada e área cenográfica perdida | Um placar por composição; expansão apenas quando necessária |
| Média | Telão continua usando superfícies azul-claro e o mesmo tabuleiro básico da interface pública | Cabeçalho próprio não basta para criar palco | Night contínuo, tabuleiro amplo e ranking lateral integrado |
| Média | Conta é um painel inserido acima da entrada | Ao abrir, desloca a composição toda | Painel de conta independente com foco gerenciado, mantendo callbacks |
| Estrutural | `globals.css`: 2.064 linhas; `game-app.tsx`: 2.432 linhas | Alto acoplamento para mudanças visuais | Extrair experiência por experiência sem mover comandos ou estados |

### O que já existe e deve ser aproveitado

A biblioteca já possui busca, filtros, paginação e seleção; não deve ser reconstruída como uma funcionalidade nova. Já existem controles contextuais por fase, consulta da resposta no mobile, placar compacto, anúncio acessível, lógica de roleta sincronizada e modo telão próprio. Os ganhos virão da hierarquia, composição, consistência e extração dos componentes visuais.

## Inventário das telas e estados

| Experiência | Situação verificada | Evidências representativas |
|---|---|---|
| Landing `/` | V4 publicada, desktop e mobile; referências de cartas, mint, gold e tipografia | [1440](capturas/landing-1440x900.jpg), [390](capturas/landing-390x844.jpg) |
| Entrada `/jogar` | Apelido, criar sala, código, autenticação anônima | [1440](capturas/entrada-1440x900.jpg), [320](capturas/entrada-320x720.jpg) |
| Conta | Login/cadastro e recuperação abertos, sem enviar credenciais nem e-mail | [Conta](capturas/conta-desktop.jpg), [Recuperação](capturas/recuperacao-desktop.jpg) |
| Lobby `/sala/[id]` | Código, convites, cinco participantes, presença e papéis | [Host](capturas/lobby-host-1440x900.jpg), [Mobile](capturas/lobby-host-390x844.jpg), [Jogador](capturas/lobby-jogador.jpg) |
| Escolha do organizador | Sorteio real e retorno manual ao host original | [Instante após solicitação](capturas/roleta-em-curso.jpg), [Resultado](capturas/roleta-resultado.jpg) |
| Preparação | Rodadas, 22 palavras, categorias e modo automático | [Desktop](capturas/lobby-host-1440x900.jpg) |
| Biblioteca | Modo manual, catálogo e busca por “Tour de France” | [Lista](capturas/biblioteca-desktop.jpg), [Busca](capturas/biblioteca-busca.jpg) |
| Organizador em rodada | Tabuleiro de 22 posições, pergunta privada e operação | [1440](capturas/rodada-host-1440x900.jpg), [390](capturas/rodada-host-390x844.jpg) |
| Seleção | Posição pública selecionada ainda não revela palavra | [Host](capturas/selecao-host.jpg), [Telão](capturas/selecao-telao.jpg) |
| Revelação e palpite | Palavra aparece nas quatro telas públicas; input e comparação no host | [Host](capturas/palpite-host.jpg), [Mobile](capturas/palpite-mobile.jpg), [Telão](capturas/revelacao-telao.jpg) |
| Julgamento e erro | Palpite incorreto e confirmação humana, mudança de jogador | [Julgamento](capturas/julgamento-mobile.jpg), [Após erro](capturas/erro-mobile.jpg) |
| Pausa e retomada | Comando real; aviso também no jogador e telão | [Host](capturas/pausa-host-mobile.jpg), [Telão](capturas/pausa-telao.jpg) |
| Desconexão e reconexão | Contexto do jogador offline, retorno online e reload preservando revelação | [Offline](capturas/offline-jogador.jpg), [Retorno](capturas/reconectado-jogador.jpg) |
| Tela dos jogadores | Acompanhamento público sem `.private` ou `.controls` | [1440](capturas/rodada-jogador-1440x900.jpg), [390](capturas/rodada-jogador-390x844.jpg) |
| Telão `/?codigo=…&telao=1` | Sessão própria e somente leitura; tabuleiro de 22 palavras em Full HD | [1920×1080](capturas/rodada-telao.jpg) |
| Resultado com acerto | Resposta aparece nas quatro sessões públicas, pontuação e avanço manual | [Desktop](capturas/resultado-host-1440x900.jpg), [Mobile](capturas/resultado-host-390x844.jpg), [Telão](capturas/resultado-telao.jpg) |
| Resultado sem acerto | 22 revelações e desistências até encerrar sem pontos | [Host](capturas/sem-acerto-host.jpg), [Telão](capturas/sem-acerto-telao.jpg) |
| Encerramento e pódio | Avanço manual encerra, campeão e classificação | [Desktop](capturas/podio-host-1440x900.jpg), [Mobile](capturas/podio-host-390x844.jpg), [Telão](capturas/podio-telao.jpg) |
| Histórico | Lista da partida concluída na mesma sala | [Histórico](capturas/historico-desktop.jpg) |
| Nova partida | Início pela interface, retorno ao tabuleiro | [Host](capturas/nova-partida-host.jpg) |
| Perguntas próprias | Botão desabilitado para conta anônima; implementação inspecionada no código | Exige conta permanente de teste para validar criação/edição real |
| Áudio | Controles existentes e implementação inspecionados; não foi certificado por escuta | Validar som opt-in e volume na homologação |

O modo telão foi aberto no lobby e durante as rodadas. O resultado da roleta continuou determinado pelo backend; a escolha manual também foi feita pela interface. Apesar do nome do arquivo, a captura “roleta-em-curso” foi solicitada imediatamente após o clique e ainda mostra o lobby antes da atualização visual: ela não comprova o giro. A captura do resultado comprova o anúncio posterior; os vídeos locais registram o fluxo temporal, sem uma análise quadro a quadro nesta fase.

## Proposta de design system

### Primitivos

| Token proposto | Valor | Papel |
|---|---|---|
| `--palette-night` | `#11162C` | Cenário contínuo |
| `--palette-night-secondary` | `#1E2144` | Superfícies de palco |
| `--palette-mint` | `#79F5CB` | Revelação e ação principal |
| `--palette-gold` | `#FFCF65` | Pontos e recompensa |
| `--palette-lilac` | `#A99CFC` | Preparação, seleção e detalhe privado |
| `--palette-paper` | `#F5F5F1` | Cartas e operação clara |
| `--palette-muted` | `#B4BCD3` | Texto secundário sobre Night |
| `--palette-ink` | `#101633` | Texto sobre superfícies claras e profundidade |
| `--palette-line` | `#3C416B` | Separadores sobre Night |

Preservar as escalas de espaçamento existentes de 4, 8, 12, 16, 20, 24, 32, 48 e 64 px. Raios por papel: 8–12 px em controles compactos, 12–16 px em cartas e 20–24 px em painéis de palco. Bordas estruturais de 2 px e sombras deslocadas de 3, 5 ou 8 px. Evitar gradientes decorativos nos painéis. Os ícones 2.5D de categoria derivam de desenhos vetoriais próprios; os mockups mostram a linguagem inicial, não um pacote final de ilustrações.

### Semânticos

| Família | Mapeamento proposto |
|---|---|
| `bg-canvas`, `bg-stage`, `surface-stage` | Night / Night / Night Secondary |
| `surface-default`, `surface-operational` | Paper |
| `text-primary`, `text-on-dark`, `text-muted` | Ink / Paper / Muted |
| `action-primary`, `action-primary-text` | Mint / Ink |
| `action-secondary` | Contorno contextual e superfície neutra |
| `selected`, `selected-border`, `revealed` | Lilac / Mint / Mint, acompanhados por texto, número e estado acessível |
| `reward`, `reward-text` | Gold / Ink |
| `private-information` | Superfície escura distinta, faixa lilás e rótulo “Só você vê” |
| `focus-on-dark`, `focus-on-light` | Gold / Ink, com afastamento e sem depender de shadow |
| `success`, `error`, `warning` | Manter papéis distintos e mensagens; ajustar tons após medição de contraste |
| `disabled` | Sem hover/press; contraste de conteúdo preservado quando necessário para leitura do tabuleiro |

Muted é destinado a fundos escuros. Mint e Gold não serão usados como texto normal sobre Paper. A linha estrutural não substitui o contraste de um controle ou foco. A Fase 1 deve medir os pares reais em todos os estados antes de declarar WCAG AA.

### Tipografia

Centralizar as fontes Changa One (400 normal; italic apenas quando usado pela landing) e Nunito Sans em `layout.tsx`, por `next/font/google`. Preservar os valores computados da landing: mover o carregamento não pode mudar sua aparência. Remover Lilita One e o `@import` de Google Fonts do CSS do jogo depois de validar a migração.

Display: marca, turno, resultados, pontuação e títulos curtos. Corpo: perguntas, palavras abertas, apelidos, menus, inputs e ações. Base de 16 px, metadados 12–14 px, palavras 14–20 px conforme a grade; títulos operacionais 24–32 px e títulos cenográficos maiores no telão. Palavras longas quebram linha sem ellipsis e sem altura fixa que corte conteúdo. Escala final condicionada às capturas com 22 palavras.

### Tokens por componente

Reaproveitar os nomes existentes de button/card/tile e completar os papéis ausentes. Button: primary/secondary/quiet/danger e loading. Tile: hidden/selected/pending/revealed/recent/disabled. Score: default/turn/leader/earned. Stage: participant/host/television. Roulette: segment/pointer/label/result. Private panel: background/accent/label. Modal e sheet: backdrop/surface/focus/safe-area/max-height. Player chip: avatar/name/presence/role.

## Direção de cada experiência

| Experiência | Composição proposta | Prioridade |
|---|---|---|
| Entrada | Marca V4, título curto, apelido único e formulário Paper com criar/entrar separados | Entrar no jogo |
| Lobby | Código e convite, pessoas com papéis/presença e roleta; resumo de prontidão | Reunir e iniciar |
| Preparação | Configuração por grupos, categorias de mesma altura e resumo junto do CTA | Entender o que será jogado |
| Biblioteca | Busca, filtros e paginação existentes; contagem selecionada persistente e prévia privada | Selecionar sem perder contexto |
| Host desktop | Tabuleiro amplo à esquerda; pergunta privada e comando contextual à direita | Operar sem buscar controles abaixo do tabuleiro |
| Host mobile | Cabeçalho e placar reduzidos; tabuleiro, ação contextual e consulta privada recolhível | Selecionar e confirmar com o menor deslocamento possível |
| Jogador | Turno, pontos, tabuleiro e um placar compacto; ranking completo expansível | Ler a situação em uma olhada |
| Telão | Tabuleiro maior em palco Night, turno forte, recompensa Gold e ranking lateral | Acompanhar à distância |
| Acerto | Nome, pontos, resposta e pergunta; placar atualizado; próximo passo só no host | Dar peso à conquista |
| Sem acerto | Conclusão neutra, sem coroa nem linguagem de vitória; resposta pública e avanço manual | Encerrar com clareza |
| Pódio | Campeão, coroa original em 2.5D, três colocações e ranking completo | Celebrar e preparar a próxima |
| Conta/configurações/histórico | Paper operacional sobre Night; mensagens e estados vazios coerentes | Resolver tarefas secundárias sem disputar foco com a partida |

### Mobile e alturas pequenas

O mockup de confirmação em 390×844 mostra as 22 posições e o CTA principal próximos. Em 320×720 o conteúdo ainda precisa de rolagem: isso está registrado nos resultados dos mockups, não é apresentado como experiência já resolvida. Na Fase 3, testar redução de metadados, reposicionamento contextual e sheet secundário. Qualquer painel fixo terá espaço reservado e deverá deixar todas as posições alcançáveis. Pergunta expandida e teclado aberto precisam ser testados com `visualViewport` e teclado real. Nenhuma conclusão sobre teclado virtual foi inferida da emulação desktop.

### Telão

O mockup Full HD usa 6 colunas e 4 linhas, com ranking lateral, em vez das 5 colunas e do placar duplicado observados. A grade não tem a mesma densidade do host. Nenhuma informação privada, autenticação, áudio ou comando de julgamento deve aparecer. O controle existente de tela cheia pode permanecer como utilitário discreto. Para projeção real, medir legibilidade e distância; screenshots não certificam leitura em sala física.

## Motion proposto, ainda não implementado

| Evento | Movimento e duração proposta | Origem do evento |
|---|---|---|
| Entrada na sala / participante | Fade + deslocamento de 6 px, 180–220 ms | Snapshot de presença |
| Roleta | Rotação com desaceleração; preservar o fluxo atual de cerca de 2 s e anúncio posterior | Resultado e timestamp do backend |
| Seleção / confirmação | Press de 2 px e contorno, 100–150 ms | Estado recebido da partida |
| Revelação | Virada curta, 240–300 ms, conteúdo público apenas após confirmação | Palavra recebida no snapshot |
| Palavra recente | Elevação de 2–3 px, 180 ms | Índice `last`, sem repetir em reload |
| Erro | Deslocamento horizontal de 3 px, 140 ms, restrito ao feedback | Julgamento confirmado |
| Acerto / pontos | Entrada da resposta e incremento visual, 280–420 ms | Resultado confirmado |
| Troca de jogador | Crossfade, 160–200 ms | Jogador atual atualizado |
| Avanço de rodada | Fade + deslocamento de 8 px, 220 ms | Avanço manual aceito |
| Encerramento / vitória | Entrada escalonada do campeão e pódio, 400–650 ms no total | Estado final confirmado |
| Nova partida | Saída curta do resultado e entrada do tabuleiro, 200 ms | Nova partida confirmada |

Tokens: instant 80 ms, fast 150 ms, base 220–250 ms, flip 280 ms, celebration 420 ms. Easing operacional `cubic-bezier(.2,0,0,1)`; pop apenas em recompensa, sem elasticidade nos inputs. `transform` e `opacity` preferenciais. Com movimento reduzido, omitir rotação/flip/deslocamento e manter texto e atualização de estado. Preservar áudio opt-in e os eventos existentes. Não adicionar atrasos ao protocolo para acomodar animações.

## Arquitetura proposta para as fases seguintes

1. Fase 1: ajustar os três arquivos de sistema existentes; centralizar fontes; atualizar os componentes em `src/components/ui/`; registrar os pares de contraste. Manter CSS da landing e suas regras computadas intactos.
2. Restringir o estilo do aplicativo à raiz `.app` e migrar blocos gradualmente para CSS Modules por experiência. `globals.css` terminará como reset mínimo, imports e estilos realmente globais. A camada defensiva `.landing-v4 { all: initial }` não deve ser removida durante a migração.
3. `game-app.tsx` continua responsável por autenticação, snapshots, Realtime, heartbeat, comandos e controle do fluxo. Extrair `EntryScreen`, `RoomLobby`, `MatchPreparation`, `QuestionSelector` e vistas de rodada com props de apresentação e callbacks existentes.
4. Extrair Board/Tile/HostControlPanel/PlayerView/TelevisionStage preservando posições, conteúdo, `aria-label`, fase e regras de habilitação. Não substituir o reducer/protocolo por estados visuais locais.
5. Extrair resultados, vitória, conta e histórico na Fase 5, após estabilização das vistas de rodada.

Pontos sensíveis: manter os parâmetros `codigo`, `telao`, `code`, `token_hash`, `error`, `type`; preservar o redirecionamento de callback implícito com fragmento em `landing.tsx`; preservar as chaves distintas `arriscai-auth` e `arriscai-screen-auth`; manter versão esperada/idempotência de comando. A roleta deve continuar usando winner e timestamp do servidor. Não alterar a fórmula de pontos, contagem do `?`, reservas ou desempates por motivos de layout.

## Validação executada

| Verificação | Resultado e limite |
|---|---|
| Produção, fluxo real de cinco sessões | Concluído, `completed: true`; 70 capturas, zero `pageerror` e zero erros de console na execução concluída |
| Seis viewports exatos | 320×720, 390×844, 768×1024, 1360×768, 1440×900, 1920×1080 em landing, entrada, lobby do host, host ativo, jogador ativo, resultado do host e pódio do host |
| Outros estados | Capturas nas dimensões indicadas pelo manifesto; não se afirma que cada estado foi exercitado em todos os seis tamanhos |
| Overflow horizontal | Não detectado nas 70 capturas medidas; não certifica ausência de clipping interno em todo conteúdo possível |
| Sigilo na UI | `.private` e `.controls` ausentes para três jogadores e telão; a proteção do endpoint é coberta separadamente por SQL e E2E isolado |
| Multiplayer real | Criar/entrar, sorteio e escolha manual, 22 palavras, seleção, revelação, erro, turno, pausa, retomada, offline/reload, resultado público, sem vencedor, pódio e nova partida |
| Fontes na produção | Estilos computados da landing: Changa One e Nunito Sans; aplicativo: Nunito Sans no body e Lilita One nos displays, conforme código |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm run build` | Passou, Next.js 16.4.6 com Webpack; nenhuma publicação |
| `npm test` | 17 testes passaram em 2 arquivos, incluindo identidade anônima; primeira tentativa bloqueada por EPERM em temporários do sandbox, repetição fora do sandbox passou |
| `npm run test:db` | 28 verificações passaram, PGlite local; não é homologação do Supabase hospedado |
| `npm run test:migrations` | Passou em banco local isolado; nenhuma migration aplicada ao Supabase |
| Suíte Playwright existente | Resultado registrado em `validacao-local.md` |
| Mockups isolados | Fontes carregadas e nenhum overflow horizontal nas 11 combinações renderizadas; algumas vistas têm rolagem vertical |

Os vídeos da auditoria real estão em `.tmp/audit-v4/videos/`, fora do commit por volume. O roteiro grava uma sessão por contexto. As capturas, manifesto e mockups ficam versionados. A galeria local inclui links para os cinco vídeos da execução concluída.

## Limites e pendências reais

- Não há certificação completa WCAG 2.2 AA nesta fase. Revisão de teclado, contraste dos estados, foco em overlays, leitor de tela, zoom real de 200% e redução de movimento devem receber evidência específica nas fases de implementação/QA.
- Viewports foram emulados em Chromium desktop; não houve teste em aparelho físico nem teclado virtual real.
- Login por e-mail, confirmação de conta, recuperação enviada, troca de senha e edição real de perguntas próprias não foram executados com conta permanente. Os painéis e código foram inspecionados, e os testes unitários/SQL cobrem somente seus respectivos escopos.
- A alternância offline/online seguida de reload confirmou persistência da pista; não certifica, sozinha, todos os tempos de reconexão de Realtime ou retomada automática após desconexão do organizador.
- A prova de sigilo na produção é visual/DOM. A suíte local também testa endpoints e autorização, sem substituir uma auditoria de segurança hospedada.
- Mockups não são frontend implementado, não simulam o protocolo e não validam performance multiplayer. Ilustrações 2.5D, estados de palpite com teclado, transições completas e layouts de perguntas extremas serão detalhados nas fases correspondentes.
- O novo visual não foi aplicado à landing ou ao aplicativo. Não existe “depois” implementado nesta fase: as imagens novas estão explicitamente rotuladas como proposta.

## Próximo passo autorizado somente após aprovação

Implementar apenas a Fase 1: tokens, fontes, componentes-base, estados interativos e organização inicial do CSS. Congelar capturas comparáveis da landing antes/depois e medir alterações. Qualquer diferença visual na landing deve ser corrigida ou submetida à aprovação; não deve ser tratada como efeito colateral aceitável.
