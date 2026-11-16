# Arriscaí!

Referência visual exclusiva: landing V4 implementada em `src/components/landing/`. Direção: Game Show Premium + Arcade Social. Landing e aplicativo compartilham a identidade; organizador, jogador e telão mantêm composições próprias.

O tabuleiro é a identidade principal durante a rodada. Primitivos, papéis semânticos e tokens de componente ficam em `src/styles/tokens.css`.

| Token | Valor | Uso |
|---|---|---|
| Night | #11162C | Cenário |
| Night Secondary | #1E2144 | Palco e informação privada |
| Mint | #79F5CB | Ação primária e revelação |
| Gold | #FFCF65 | Pontos e recompensas |
| Lilac | #A99CFC | Seleção e detalhe privado |
| Paper | #F5F5F1 | Cartas e operação |
| Muted | #B4BCD3 | Texto secundário sobre Night |
| Ink | #101633 | Texto escuro e profundidade |
| Line | #3C416B | Bordas sobre Night |

Fontes Changa One em marca, títulos e pontuação; Nunito Sans em palavras, perguntas e operação. Carregamento central por `next/font/google` no layout raiz. Não usar a fonte display nos textos de perguntas ou inputs.

O cenário usa Night. A operação usa Paper, a seleção Lilac com contorno Mint, a revelação Mint e as recompensas Gold. A informação privada usa superfície escura, faixa Lilac e rótulo explícito. Preferir superfícies sólidas, bordas e sombras deslocadas. Cor não é o único sinal de estado.

A entrada alterna entre criar sala e entrar por código, preservando o apelido. Convites abrem diretamente o código preenchido. O rodapé fica fixo, separado da área central de rolagem. No lobby, participantes usam avatares circulares pequenos e a escolha de outro organizador fica recolhida por padrão. Todos acompanham a prévia pública da preparação; apenas o organizador edita, e perguntas/respostas continuam privadas.

`globals.css` é o hub de imports. Os estilos do aplicativo ficam restritos a `.app` em `src/styles/game/`. `legacy.css` preserva estruturas ainda utilizadas com escopo restrito; novos ajustes pertencem a shell/lobby/play/results. A landing conserva suas regras locais.

O organizador desktop usa tabuleiro e operação em duas colunas. No mobile, o painel contextual segue o tabuleiro, a consulta privada fica recolhível e o ranking completo é expansível. Painéis não cobrem posições nem inputs. O telão usa seis colunas em Full HD, ranking lateral e nenhuma ação de jogo.

Componentes visuais ficam em `src/components/game/`; autenticação, comandos, snapshots, heartbeat e sincronização continuam em `game-app.tsx`. Não duplicar estados de partida para produzir animações. A roleta anuncia o resultado recebido do backend; o avanço da rodada permanece manual.

Revelações e resultados usam transform/opacity com tokens de motion. Movimento reduzido elimina deslocamentos e viradas no aplicativo. Som continua opt-in.

Evidências da integração oficial e limites de homologação: `docs/v4-oficial/README.md`. Auditoria anterior e proposta aprovada: `docs/auditoria-v4/README.md`.
