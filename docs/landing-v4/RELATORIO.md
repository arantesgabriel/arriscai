# Landing Arriscaí! GDevelop V4

## Refinamentos posteriores solicitados

Textos da interface atualizados de “turma” para “galera”; removidos travessões textuais e traços decorativos antes das frases. CTA final compactado, tracejado do portal removido, explicação dos pontos simplificada e convite da demonstração redesenhado. Identificadores das regras usam peso normal e os números dos quadrados foram reduzidos.

No mobile, os textos de apoio e títulos são menores em extensão, as regras usam uma composição mais compacta e os espaços verticais foram reduzidos. O desktop mantém seus textos completos.

Os exemplos de recursos agora animam em ordem: chegada dos participantes (760 ms), subida de Bia de 0 a 22 pontos com mudança de posição (aproximadamente 924 ms) e flip do telão (440 ms incluindo espera). Com os três cards visíveis, a sequência leva aproximadamente 2,1 segundos. Em telas estreitas, cada etapa aguarda seu card ficar visível. Movimento reduzido apresenta os estados finais sem essas transições.

As capturas comparativas abaixo documentam a V4 inicial, anterior a esses refinamentos intencionais. Os testes de regressão foram atualizados para os novos textos e incluem a ordem das animações e a espera por visibilidade no mobile.

Implementação na branch `dev`, conforme orientação atualizada. Sem merge, push ou deploy. Nenhuma dependência adicionada.

## Referência e arquitetura

Referência obrigatória: `C:/Users/Gabriel/Downloads/FireShot/arriscai_v4_codex_leve/index.html`, README, relatório de QA e `arriscai-og.png`. Os documentos foram tratados como contexto da referência, sem substituir as instruções do usuário. A pasta fornecida não contém `evidencias/`; as imagens de referência deste relatório foram renderizadas diretamente do HTML fornecido.

SHA-256 do HTML: `91694C3BFEBC9C574B7BEBB5335D1BFDD22902586EA1D997780ECD8CD20F41F0`.

O projeto usa Next.js 16.4.6, App Router, React 19, TypeScript, Supabase e Playwright/Vitest. Antes desta integração, `/` montava diretamente `GameApp`; `/sala/[id]` monta o mesmo componente com a sala. Foram consultadas as guias locais dessa versão do Next.js para páginas, limites cliente/servidor, fontes e metadados.

## Alterações

- `/` renderiza todas as seções V4: cabeçalho, hero/portal/tabuleiro, simulador, regras, demonstração, recursos, CTA e rodapé.
- `src/components/landing/sections.tsx`: componentes reutilizáveis para as seções, preservando estrutura, textos e ilustrações CSS do HTML.
- `interactions.tsx`: simulador 1→22, 4→19 e 22→1; demonstração local de 14 palavras com normalização de acentos, bloqueio após erro, vitória, derrota e reinício. A demonstração não acessa Supabase.
- `landing.tsx`: barra de progresso, cabeçalho fixo após rolagem, entradas por IntersectionObserver e limpeza de observers/listeners/animation frame. Conteúdo permanece renderizado sem JavaScript.
- `landing.css`: estilos e tokens da V4 limitados a `.landing-v4`, com proteção contra estilos globais do aplicativo. Preservados keyframes, durações, breakpoints e movimento reduzido. Corrigidas interferências nas setas SVG e na opacidade das palavras reveladas.
- `/jogar` monta o `GameApp` existente. Todos os CTAs V4 apontam para essa rota. Os convites `/?codigo=...`, telão e callbacks de autenticação continuam no fluxo original; callbacks com credenciais no fragmento são encaminhados a `/jogar`, preservando o fragmento para o cliente de autenticação existente.
- Fonte Changa One via `next/font/google` e fonte Nunito Sans já existente, auto-hospedadas no build. A fonte do restante do jogo foi preservada.
- Metadados de título, descrição, canonical, Open Graph e Twitter; imagem original de 1200×630 em `public/arriscai-og.png`; favicon SVG; tema `#11162c`.
- `NEXT_PUBLIC_SITE_URL` documentada em `.env.example`, com padrão `https://arriscai.vercel.app` para URLs absolutas.
- Testes antigos passam a abrir `/jogar` para iniciar uma sala. Links antigos de convite continuam sendo exercitados pela regressão multiplayer.

Nenhuma alteração nas bibliotecas Supabase, autenticação, componente multiplayer, regras, catálogo, SQL ou migrations.

## Capturas comparativas

As comparações mostram **HTML de referência à esquerda e Next.js à direita**. O build de produção foi executado apenas em localhost. As mesmas fontes auto-hospedadas foram usadas nos dois documentos; isso evita comparar as fontes reais da implementação com os fallbacks mencionados no QA original. Movimento reduzido foi usado para congelar a captura; o movimento normal recebeu teste separado.

| Viewport | Comparação completa |
| --- | --- |
| 320×844 | [Abrir](captures/comparison-320.png) |
| 390×844 | [Abrir](captures/comparison-390.png) |
| 768×1024 | [Abrir](captures/comparison-768.png) |
| 1360×900 | [Abrir](captures/comparison-1360.png) |
| 1440×900 | [Abrir](captures/comparison-1440.png) |
| 1920×1080 | [Abrir](captures/comparison-1920.png) |

As 11 regiões medidas (hero, título, cena, pontuação, simulador, regras, demonstração, frame, recursos, CTA e rodapé) apresentaram **delta de 0 px** em posição e dimensão, com valores registrados a duas casas decimais, em todas as larguras. Não houve overflow horizontal.

No estado inicial, pixels com diferença de canal RGB superior a 24 representam menos de 0,01% de cada imagem. Essa é uma métrica auxiliar de rasterização, não uma certificação de igualdade absoluta. Valores e retângulos completos: [comparison-metrics.json](captures/comparison-metrics.json).

| Estado | 390 px | 1440 px |
| --- | --- | --- |
| Simulador: 22 pistas / 1 ponto | [Comparação](captures/comparison-score22-390.png) | [Comparação](captures/comparison-score22-1440.png) |
| Erro e bloqueio de novo palpite | [Comparação](captures/comparison-wrong-390.png) | [Comparação](captures/comparison-wrong-1440.png) |
| Vitória com acentos: 13 pontos | [Comparação](captures/comparison-win-390.png) | [Comparação](captures/comparison-win-1440.png) |
| Derrota após 14 palavras | [Comparação](captures/comparison-loss-390.png) | [Comparação](captures/comparison-loss-1440.png) |

Arquivos `next-*` e `reference-*` na mesma pasta permitem inspecionar cada lado separadamente.

## Validação executada

| Comando / cenário | Resultado |
| --- | --- |
| `npm run lint` | Sem erros ou avisos |
| `npm run typecheck` | Passou |
| `npm run build`, em `.tmp/next-build-v4` | Passou; fontes carregadas e rotas geradas |
| `npm test` | 17 testes passaram |
| `npm run test:db` | 28 checks passaram, SQL/RLS/RPC reais em PostgreSQL isolado |
| `npm run test:migrations` | Upgrade incremental passou |
| `npx playwright test` | 8 passaram; 1 teste exclusivo de Supabase hospedado foi ignorado conforme configuração |
| `npx playwright test tests/e2e/landing.spec.ts` no build de produção local | 8 testes da landing passaram |
| Regressão multiplayer | Organizador, três jogadores, telão, espectador tardio, partida e resultados passaram no harness isolado |

Interações verificadas nos seis tamanhos: seleção e `aria-pressed` do simulador; 22 mini-tiles; bloqueio inicial do palpite; revelação e palavra longa `principalmente`; um palpite por pista; erro e nova pista obrigatória; resposta com acentos; vitória; derrota após todas as palavras; reinício; ausência de erros JavaScript; ausência de overflow; CTA abre a tela real do jogo.

Também verificados: navegação por teclado/Enter e skip link; conteúdo com JavaScript desligado; preferência de movimento reduzido; nomes e durações dos keyframes do portal/cartão/moeda; transformação efetiva do portal entre frames; âncoras; cabeçalho fixo e progresso ao rolar; metadados OG absolutos.

Uma primeira execução de desenvolvimento clicou no simulador antes da hidratação. O teste agora aguarda explicitamente `data-ready`, e as execuções posteriores passaram. O sandbox impedia acesso do navegador ao localhost e gravações temporárias do Vitest; as validações foram repetidas fora dessa restrição, com êxito.

## Reproduzir

```powershell
npm run dev
npx playwright test
node scripts/qa-landing-v4.mjs "C:/caminho/da/referencia/index.html"
```

Para validar outro servidor, defina `ARRISCAI_QA_URL` para o script de capturas; para Playwright use `ARRISCAI_E2E_PORT` e `PW_REUSE_SERVER=1`. `ARRISCAI_QA_OUTPUT` permite escolher a pasta de saída. O Chromium instalado deve estar disponível ao Playwright; neste computador foi usado `PLAYWRIGHT_BROWSERS_PATH=C:/Users/Gabriel/AppData/Local/ms-playwright`.

## Limites e pendências de publicação

- A regressão isolada simula o transporte Auth/Realtime e executa SQL/RLS reais. Não certifica Supabase hospedado, provedores externos de login, entrega de e-mail ou redes reais de dispositivos diferentes. O teste exclusivo de staging permanece condicionado a `ARRISCAI_LIVE_E2E=1` e às proteções existentes de staging.
- Testes visuais feitos em Chromium. Safari, Firefox, dispositivos físicos e auditoria assistiva completa não foram certificados.
- Lighthouse/Core Web Vitals em hospedagem pública não foram medidos. O build de produção foi validado localmente.
- Antes de publicar em domínio diferente, configurar `NEXT_PUBLIC_SITE_URL` com o endereço público correto.
- Merge e deploy dependem da aprovação do usuário e não foram executados.
