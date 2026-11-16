# TOKENS — Arriscaí! (Fase 1)

Arquivos: `src/styles/tokens.css` (primitivos, semânticos, componente), `typography.css`, `motion.css`, `theme.css` (mapeamento Tailwind v4, **ainda não conectado**).
Carregados em `src/app/layout.tsx` depois de `globals.css`. Nenhuma variável legada foi removida ou alterada.

## Camadas
1. **Primitivos** `--palette-*`, `--space-*`, `--radius-*`, `--border-*` — valores brutos. Não usar direto em componentes.
2. **Semânticos** `--color-bg-*`, `--color-surface-*`, `--color-text-*`, `--color-border-*`, `--color-action-*`, `--color-success|danger|highlight`, `--shadow-tactile-*`, `--focus-ring`, `--font-*`, `--text-*`, `--motion-*`, `--ease-*`.
3. **Componente** `--button-*`, `--card-*`, `--field-*`, `--tile-*`, `--score-chip-*`, `--host-dock-height`.

## Mapeamento antigo → novo
| Legado (`globals.css`) | Novo primitivo | Semântico principal |
|---|---|---|
| `--blue #087df2` | `--palette-blue-500` | `--color-bg-stage`, `--tile-bg-hidden`, `--color-focus-ring` |
| `--white #fff` | `--palette-white` | `--color-surface-default`, `--color-text-inverse` |
| `--gold #ffbe3b` | `--palette-gold-400` | `--color-action-primary`, `--color-highlight` |
| `--ink #102e53` | `--palette-ink-900` | `--color-text-primary`, `--color-border-strong` |
| `--soft #eaf6ff` | `--palette-blue-50` | `--color-bg-canvas`, `--color-surface-subtle` |
| `--success #10765e` | `--palette-success-700` | `--color-success-text` (preenchimento: `--palette-success-500 #1BBC91`) |
| `--danger #b12647` | `--palette-danger-700` | `--color-danger-text` (preenchimento: `--palette-danger-500 #E95672`) |
| `--display` | — | `--font-display` (next/font Lilita One) |
| `--body` | — | `--font-body` (next/font Nunito Sans) |
| `--radius 22px` | — | `--card-radius` = `--radius-2xl` (24px) · valor muda por design |
| `--wheel-label-radius` | — | será token de componente da roleta (Fase 2) |
| 20 radii soltos | `--radius-sm/md/lg/xl/2xl/pill` (8/12/16/20/24/999) | migração Fases 2–5 |
| 44 font-sizes soltos | `--text-caption … --text-stage` (9 papéis, `clamp`) | migração Fases 2–5 |

## Decisões
- **Botão brand** usa `blue-700 #0661BD`: branco sobre `#087DF2` mede 4.02:1 (falha AA para texto normal). `#087DF2` segue para tiles (texto display grande, AA large) e palco.
- Sombras **sólidas** (offset sem blur); `--shadow-overlay` é a única com blur (modais).
- `prefers-reduced-motion` zera todas as durações `--motion-*`.
- **Rufing não incluída** (sem arquivo/licença). Display = Lilita One (SIL OFL) via `next/font/google`, self-hosted no build.

## Contraste medido (WCAG 2.x)
| Par | Razão | AA |
|---|---|---|
| ink / white | 13.66 | ✅ |
| ink / soft | 12.44 | ✅ |
| ink / gold (primário) | 8.25 | ✅ |
| white / blue-500 (tile) | 4.02 | ✅ só texto grande |
| white / blue-700 (brand) | ≈6 | ✅ |
| ink / success-500 | 5.62 | ✅ |
| white / danger-700 | 6.49 | ✅ |
| success-700 / success-100 | 4.80 | ✅ |
| danger-700 / danger-100 | 5.36 | ✅ |
| ink-500 muted / white | 4.83 | ✅ |
| disabled text / disabled bg | 3.79 | isento (WCAG 1.4.3) |

## Pendências conhecidas
- Regras globais por elemento (`button {…}`, `button:disabled {opacity}`) em `globals.css` vazam para os componentes; neutralizadas onde necessário (`opacity: 1`). Removidas na limpeza (Fase 6).
- `@import` do Google Fonts no `globals.css` continua (legado); com `next/font` a fonte é baixada duas vezes até a remoção do `@import` (Fase 2, quando `globals.css` for tocado).
- `theme.css` será importado em `globals.css` na Fase 2.
