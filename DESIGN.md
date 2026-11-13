# Arriscaí!

Referência: design system e protótipo do handoff. Frontend orientado exclusivamente pela skill frontend-design, conforme solicitação do usuário.

A expressão está no bloco de interrogação com profundidade tátil. Durante o jogo, o tabuleiro é a identidade principal.

| Token | Valor | Uso |
|---|---|---|
| blue | #087DF2 | Cenário e marca |
| white | #FFFFFF | Leitura e operação |
| gold | #FFBE3B | Recompensa e ação principal |
| ink | #102E53 | Texto e profundidade |
| soft | #EAF6FF | Fundo e grupos |

Fonte Lilita One no display, Nunito Sans no corpo. Google Fonts; Arial Black/Arial como fallback sem rede. Rufing não incluída. Somente após obter WOFF2 autorizado, declarar `@font-face` e trocar `--display`.

Home em duas colunas; lobby com participantes e preparação; host com tabuleiro/controles e painel privado; jogador/telão com tabuleiro e placar. Mobile: tabuleiro, comandos, placar, material privado. Telão usa identidade Auth própria. Flip de 300 ms na revelação confirmada; movimento reduzido respeitado; som opt-in. Viewports: 390, 768, 1440, 1920.
