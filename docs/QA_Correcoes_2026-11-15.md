# Arriscaí! — correções e revalidação de 15/11/2026

**Parecer: NO-GO para publicar esta revisão como lançamento público completo.** A partida de quatro rodadas passou com frontend local e Supabase dev hospedado. As correções de frontend ainda não foram implantadas no Vercel; o catálogo da produção mudou externamente de zero elegíveis para 240 registros marcados `approved`, sem trilha de aprovação editorial apresentada. Nove desses registros ainda têm os enunciados anteriores às correções locais. Não atribuo essa mudança de dados a este trabalho nem a considero curadoria concluída.

## Ambientes, proveniência e limites da evidência

| Superfície | Identificação confirmada | O que foi feito |
|---|---|---|
| Código local | `dev`, HEAD `746a2530dcf0211e535a4db6cc0f33a8213292d0`, mais diff deste trabalho | Edição, testes, build isolado e frontend local em `127.0.0.1:3000` |
| GitHub main | `37d04aaad55a49db7e12e17f42dd0baec4c71e6f`, confirmado no conector em 15/11 | Leitura; sem push ou PR |
| Supabase dev | `arriscai-dev`, `ksouiyjszsfrqrurpepq` | E2E real, consultas agregadas e migração `202611150001` |
| Supabase produção | `arriscai-prod`, `ltrlsiqlvbjyfdoyotdd` | Apenas consultas agregadas e hashes de enunciados; sem escrita |
| Vercel | `https://arriscai.vercel.app/`; deployment do merge antigo no histórico do GitHub | Nenhum deploy novo; vínculo exato do alias com deployment não comprovado |

O Supabase CLI rotula o projeto dev como ambiente `production` *dentro daquele projeto*. O nome e a referência do projeto, além do guard que verifica o bundle servido antes de criar contas E2E, distinguem o dev do projeto público. As capturas novas em [`.tmp/qa-evidence/screenshots/`](../.tmp/qa-evidence/screenshots/) e [`.tmp/qa-evidence/states/`](../.tmp/qa-evidence/states/) vêm do frontend **local**, conectado ao backend dev hospedado. Não são capturas do deploy. O teste não ativou `tests/e2e/sql-harness.ts` nas execuções marcadas `ARRISCAI_LIVE_E2E=1`.

## Inventário editorial e B-001

Consultas SQL read-only em 15/11, sem respostas nem aliases, deram:

| Projeto | Oficiais | Distribuição | `approved` | `provisional` | `allow_provisional` |
|---|---:|---|---:|---:|---|
| Dev | 240 | 8 categorias × 30 | 0 | 240 | `true` |
| Produção | 240 | 8 categorias × 30 | 240 | 0 | `false` |

O inventário de 13/11 mostrava catálogo público vazio na produção; a situação administrativa mudou depois daquela auditoria. O dev utiliza provisórias apenas para homologação e continua separado do catálogo público. A contagem local com o tokenizer do jogo passou: 240 IDs e enunciados únicos, 30 por categoria, seis de 22 palavras em cada categoria (48 ao todo), máximo de 22. Esses números **não** equivalem a revisão factual das 240.

Uma contagem read-only adicional na produção, com a mesma regra de remoção de `?`, separação por espaços e descarte de tokens sem caracteres alfanuméricos, encontrou **240 registros oficiais aprovados com 1–22 palavras, sendo 48 de exatamente 22**. Isso verifica estoque numérico no banco em 15/11, mas não a resposta do RPC público para convidado nem a qualidade editorial.

Comparei `md5(question)` dos IDs Q0221, Q0328, Q0421, Q0422, Q0425, Q0703, Q0808, Q0825 e Q0830 na produção com o arquivo atual e com o HEAD anterior. Os nove hashes de produção coincidem exatamente com os enunciados **anteriores** e divergem dos enunciados corrigidos. Esses itens estão `approved` na produção. A revisão responsável deve registrar fonte, revisor, decisão e publicação por item; não há base para aprovar todos por uma troca de status. As nove sugestões locais seguem `provisional` e não foram sincronizadas ao banco remoto.

Uma varredura textual local adicional encontrou Q0221, Q0328 e Q0425 com a resposta literal no enunciado. Corrigi os três. A verificação automatizada agora não encontra a resposta literal normalizada em nenhum dos 240 enunciados locais; ela não detecta pistas semânticas, ambiguidade ou erro factual. Há 14 respostas normalizadas reutilizadas em mais de um item, até três vezes cada; repetição de resposta não prova pergunta duplicada, e o equilíbrio temático ainda precisa de leitura editorial.

Uma nova migração limita-se a distinguir catálogo globalmente sem elegíveis de filtro insuficiente em `prepare_match`. O teste isolado cobre ambos os casos, sem mudar a política `allow_provisional`. O dry run apontou apenas `202611150001_catalog_empty_message.sql`; a aplicação no projeto dev passou e `migration list` confirmou 001, 002 e 003. A migração não foi aplicada à produção, e a mensagem específica de estoque zero não foi testada no ambiente público.

## B-001–B-007 e E-001

| ID | Causa e correção | Evidência nova | Situação |
|---|---|---|---|
| B-001 | Estoque elegível zero em 13/11; mensagem SQL globalmente vazia passou a orientar liberação editorial ou pergunta própria sem exigir cadastro para jogar. | SQL dev 240 provisórias, produção 240 aprovadas; teste PGlite do ramo vazio; hashes dos nove itens antigos. | **Pendente**: origem da aprovação, curadoria e partida pública após processo editorial. |
| B-002 | `identity()` permitia duas signups concorrentes. Promessa compartilhada, estado de carregamento/erro e retry bloqueiam create/join até UID estável. | `tests/identity.test.ts`; `staging-states.spec.ts` com request atrasada, uma signup, UID de storage/membership/reload igual. | Passou no dev real; frontend não implantado. |
| B-003 | Primeiro ID da roleta era ignorado e cleanup podia cancelar o único timer. Evento recente agora inicia o primeiro giro; timer em ref termina sem depender de snapshots/membros/som. Lista de fatias fica estável durante o giro, e reduced motion anuncia imediatamente. | `staging-states.spec.ts`: primeiro e segundo giros, mudança de membros durante giro, som/volume, telão reduced motion; captura `roulette-first-tv-1920x900.png`. | Passou no dev real; falta reteste no deploy e matriz de resultados de host mais ampla. |
| B-004 | Indicador misturava estado REST e Realtime. Saúde do canal e heartbeat REST agora são estados distintos; retorno de rede dispara nova verificação. | `staging-states.spec.ts`: offline/online sem reload, volta para “Ao vivo” e recebe atualização manual do host. | Passou no dev real; sem ensaio prolongado de queda do host no jogo ativo. |
| B-005 | Erro 23505 chegava como objeto PostgrestError e mostrava constraint. `rpc` preserva código; `humanError` traduz duplicata e mantém foco/apelido. | Teste unitário e tentativa real de nickname repetido: 409, mensagem útil, foco e valor preservados. | Passou no dev real; frontend não implantado. |
| B-006 | Lobby do telão usava coluna estreita. Grid em largura de palco, nomes e roleta redimensionados. | `lobby-tv-1920x1080.png` e `lobby-tv-1920x900.png`, com conteúdo ocupando o palco horizontal; jogo ativo capturado separadamente. | Passou visualmente no frontend local; falta deploy. |
| B-007 | CSS chamava duas URLs Rufing inexistentes. Removidas; Lilita One é o fallback permitido, e Nunito Sans segue como texto operacional no design local. | Build isolado passou; CSS não referencia `/fonts/Rufing-*`. | Correção local; conferência de rede pós-deploy pendente. |
| E-001 | Nove enunciados locais corrigidos para não entregar a resposta e pedir o nome civil pretendido; Q0421 diferencia violino. | `tests/game.test.ts` valida estrutura/tokenização e ausência de resposta literal; comparação de hash prova que a produção ainda tem as versões antigas. | **Pendente**: revisão editorial das 240 e publicação seletiva. |

Para as nove propostas locais, foram consultadas fontes primárias: [IFAB, número máximo de jogadores](https://www.theifab.com/laws/2025-26/the-players/), [site oficial do filme Barbie](https://www.barbie-themovie.com/home/), [Biblioteca Nacional, carnaval e samba](https://bndigital.bn.gov.br/carnaval/), [BIPM, unidade ohm](https://www.bipm.org/documents/20126/28426876/working-document-ID-11118/34bfe847-f9f0-6795-b9f0-316a9986cbda), [Yamaha, violino](https://www.yamaha.com/en/musical_instrument_guide/violin/mechanism/mechanism002.html), [Grammy, Lady Gaga](https://www.grammy.com/artists/lady-gaga/3611/), [SEGA, Sonic](https://manuals.sega.com/sonicxshadowgenerations/en/index.html), [Nintendo, Kirby](https://www.nintendo.com/sg/switch/arzg/copy/index.html) e [ATLUS, Persona 5](https://atlus.com/atlus-titles/p5r/?ItemID=90). São referências para revisão desses itens, não aprovação automática do catálogo.

## Homologação executada

**Jogo dev real:** seis BrowserContexts com storage próprio: host, três jogadores, telão e tardio. Em partida de quatro rodadas de 22 palavras, R1 selecionou posição 6 sem revelar e marcou +22 na primeira revelação; R2 marcou +19 após três erros; R3 revelou as 22 e terminou em 0, preservando as pistas; R4 marcou +22 para Bia, líder única com 44, contra 19 e 0. Avanço manual, placares nas sessões, pergunta/resposta no resultado, pódio e histórico foram verificados. Uma nova partida zerou o placar, trocou o host e fez o organizador antigo entrar como jogador. Cenário adicional de nove palavras pontuou +8 após duas revelações. Tardio e telão mantiveram papéis adequados; cancelamento reabilitou jogadores tardios. Um teste de seleção concorrente teve uma resposta 2xx e uma 4xx. Evidência: [`tests/e2e/game.spec.ts`](../tests/e2e/game.spec.ts) e capturas em `.tmp/qa-evidence/screenshots/`.

**Estados dev reais:** uma signup Auth sob latência artificial, identidade preservada em reload, duplicata de apelido, primeiro e segundo giro com telão, mudança de membro durante giro, reduced motion e reconexão de rede passaram. Evidência: [`tests/e2e/staging-states.spec.ts`](../tests/e2e/staging-states.spec.ts) e `.tmp/qa-evidence/states/`.

**Banco isolado:** 28 verificações PGlite passaram, incluindo +1 na última revelação, empate/reserva/exaustão, versionamento, idempotência de comando, permissões e filtro insuficiente. A migração incremental de histórico passou. Isso complementa o E2E e não prova esses casos no backend público. Playwright com backend dev desliga trace de rede para não reter tokens em ZIP; capturas e vídeos de tela permanecem em `.tmp/qa-evidence/`. Não há medição atual de p95, INP, FPS ou Lighthouse. Os LCP/CLS do relatório de 13/11 eram amostras de laboratório, não métricas de campo.

## Revalidação dos 22 achados anteriores

O estado abaixo se refere a esta revisão, com os limites da coluna final; a [matriz de 89 linhas](QA_MATRIZ_2026-11-15.csv) preserva o resultado de 13/11 e explicita a nova cobertura por requisito.

| QA | Resultado em 15/11 | Limite |
|---|---|---|
| 001 | Catálogo agora tem 240 `approved` na produção | Aprovação sem proveniência; nove textos antigos; fluxo público não retestado. |
| 002 | Auth anônimo e Realtime passaram no dev real | Email permanente/SMTP e produção pendentes. |
| 003 | Resposta visível no resultado de quatro rodadas dev | Deploy pendente. |
| 004 | +22, +19, 0 e +8 verificados no dev real | +1 só no PGlite. |
| 005 | Cancelamento reabilitou tardios no dev real | Deploy pendente. |
| 006 | Seis sessões e rodízio real passaram no dev | Mais cenários de concorrência pendentes. |
| 007 | Primeiro/segundo giro e término passaram no dev | Matriz ampliada de host/reconexão durante giro pendente. |
| 008 | Preview/seleção parcial em código e teste isolado | Manual/mista com dados reais não concluídas. |
| 009 | Telão horizontal e resultado real vistos no dev | Julgamento visual do deploy pendente. |
| 010 | Placar compacto visto em jogo real | Deploy pendente. |
| 011 | Dock host visto em capturas mobile | Teste de alcance/foco manual pendente. |
| 012 | Telão sem convite/cópia/controles no dev | Mantém aprovação observada em 13/11 para lobby público antigo. |
| 013 | Histórico de quatro rodadas visto no dev | Produção não revalidada. |
| 014 | URLs Rufing removidas localmente | Rede do deploy não revalidada. |
| 015 | Sons distintos existem no código | Sem avaliação auditiva em jogo. |
| 016 | Formulário presente | SMTP, caixa postal e link real não testados. |
| 017 | Pódio visto; SVGs de categorias seguem planos | Assets soft 3D e aprovação visual final pendentes. |
| 018 | Reserva/filtros passaram no PGlite | Desempate real hospedado não executado. |
| 019 | Contadores de 30/6 por categoria vistos no dev | Publicação editorial e deploy pendentes. |
| 020 | Offline/online e atualização recebida no dev | Falha prolongada no jogo ativo pendente. |
| 021 | Anúncio ARIA presente e reduced motion exercitado | Leitor de tela humano não testado. |
| 022 | Operação não revalidada | CAPTCHA, SMTP, retenção e monitoramento pendentes. |

## Dados QA criados e segurança

No projeto dev, esta homologação criou **nove salas QA e 52 memberships distintas** (contagem read-only, filtro por data e apelidos QA). Códigos: `8063DA1B`, `48702986`, `5DC3D298`, `2324EFC1`, `40C90BD0`, `877316BF`, `250F62A0`, `3E49CDF3`, `3AB06DE0`. Duas salas de ensaio anteriores a esse filtro não entram na contagem. Nenhum dado QA foi apagado e nenhuma resposta, alias, chave privilegiada ou token de autenticação é incluído neste relatório. Houve uma execução interrompida que deixou sala ativa; a limpeza desses dados exige decisão separada. O único banco alterado por este trabalho foi o dev, com identidades/salas E2E e a migração 003; produção foi consultada apenas em read-only.

Os testes isolados exercitaram RLS, esquema privado, autoria, expected_version, idempotency_key, host fixo e deck sem segredos públicos; os locks SQL permaneceram na função. O E2E real verificou snapshot oculto antes da revelação e ausência de controles host para telão/jogador, mas **não** completou a auditoria de HTML/REST/Realtime durante todas as fases, de assinatura privada por terceiros, escrita direta, isolamento de dois autores ou chave idempotente com payload divergente no backend hospedado.

## Visual, assets e acessibilidade

As capturas cobrem home/lobby e papéis do jogo em 390, 768, 1440 e 1920 px; telão do lobby também em 1920×1080 e 1920×900. Algumas capturas `fullPage` excedem a altura do viewport. Falta fechar a matriz completa 390×667/844, 768×768/1024, 1440×900/1000 e 1920×900/1080 para **todos** os estados, medir overflow após hidratação e inspecionar foco/contraste em uso. O pódio foi finalmente observado em jogo real; ainda requer aprovação visual do projeto.

Conjunto mínimo proposto para reforçar a direção soft 3D: **(1)** um troféu/pódio pré-renderizado com material e luz coerentes, **(2)** uma roleta com peças arredondadas e ponteiro nítido, **(3)** um conjunto pequeno e consistente de oito ícones de categoria em relevo. Exportar imagens leves em tamanhos adequados, com direitos de uso registrados e variantes para fundo claro/escuro. Não há motivo técnico para introduzir engine 3D no V1.

## Critérios restantes para GO

1. Registrar revisão factual/editorial das 240 perguntas, corrigir ao menos os nove textos antigos presentes na produção e aprovar/publicar seletivamente. Confirmar depois que convidado inicia partida com oficiais elegíveis, 8 categorias e filtro de 22 palavras no ambiente de destino, sem `allow_provisional=true` público.
2. Revisar o diff, implantar a revisão no destino Vercel identificado e aplicar a migração 003 à produção **somente com autorização específica**. Repetir smoke de produção após deploy, sem converter capturas dev em evidência pública.
3. Executar no staging hospedado os cenários ainda ausentes: +1 real, empates sucessivos e reserva, manual/mista/preview, idempotência com payload divergente e versão obsoleta, pause/skip/host offline, privacidade de rede e canais, conta permanente e autores distintos. Fluxos de email exigem caixa postal legítima e SMTP funcional.
4. Fechar matriz visual/acessibilidade e operação (CAPTCHA, quotas, retenção, monitoramento). Medir performance em amostra apropriada se isso for critério de lançamento; não extrapolar as duas cargas frias de 13/11.

Os arquivos de design system e as mudanças em `src/app/layout.tsx` surgiram no workspace durante esta tarefa e foram preservados como trabalho do usuário; não são atribuídos a estas correções.
