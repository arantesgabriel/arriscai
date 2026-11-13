# Configuração de publicação — 13/11/2026

- GitHub: `arantesgabriel/arriscai`, branch `main`, commit inicial da implementação `91e6db8`. A instalação GitHub da Vercel recebeu acesso ao repositório.
- Vercel: equipe `arantesgabriels-projects`; importação `arriscai` preparada no navegador, ainda não criada nem publicada. Preset Next.js, raiz `./`, instalação `npm ci`, build `npm run build` (Webpack). Variáveis públicas carregadas no formulário somente para Production; ainda não salvas. Preview requer projeto Supabase de teste separado.
- Supabase: organização Arriscai, projeto `arriscai-prod` vinculado ao repositório. Inventário SQL não encontrou tabelas nas áreas `public` e `private`; painel informa nenhuma migration registrada. Nenhum SQL de aplicação ou seed foi aplicado nesta sessão. Realtime ativado, acesso público a canais desabilitado; policies de `realtime.messages` ainda ausentes até a migration. Email habilitado e confirmação exigida; entrada anônima desabilitada.
- `.env.local` contém URL pública do projeto hospedado, mas a URL PostgreSQL salva aponta para localhost. É necessária a conexão hospedada correta para aplicar e verificar a migration e seed. Não colocar credenciais neste documento ou no Git.
- Seed oficial: 240 questões provisórias; manter `allow_provisional=false` em produção. Não marcar questões como revisadas sem revisão real.
- Lint, typecheck, build Webpack, 13 testes unitários e 25 verificações SQL passaram localmente. Os testes SQL usam PGlite com Auth/Realtime simulados. Playwright nesta sessão não passou: servidor existente sem configuração do teste e, em cópia isolada, erro do servidor Next no fluxo da sala. Não representa homologação do Supabase hospedado.
- Pendências: obter conexão hospedada; inspecionar novamente e aplicar migration/seed transacionalmente; configurar Auth, redirects e policies; provisionar Preview isolado; publicar após configuração; validar headers, autenticação e fluxo real em projeto de teste separado; verificar CI e operação antes de acesso público.

## Atualização — Vercel

- Projeto Vercel `arriscai`, repositório `arantesgabriel/arriscai`, produção em `main`: https://arriscai.vercel.app (deploy 91e6db8 pronto).
- Preview usa as variáveis públicas do Supabase `arriscai-dev`; produção usa variáveis próprias do `arriscai-prod`. Preview de `dev`: https://arriscai-git-dev-arantesgabriels-projects.vercel.app (deploy 91e6db8 pronto). As variáveis Preview se aplicam a todas as branches não produtivas.
- Site URL e redirect de produção configurados; desenvolvimento usa URL da branch dev e redirects para localhost e o deploy atual.
- Consultado banco de produção: 240 provisórias, zero aprovadas e `allow_provisional=false`. O painel de migrations não registra a execução via SQL Editor.
- Home de produção e Preview carregaram. No Preview, autenticação anônima e criação de sala foram verificadas. Partida completa, autenticação por e-mail, headers e Realtime entre clientes ainda não foram homologados nesta sessão.
