# Arriscaí!

**Quanto menos pistas, mais pontos!** Next.js App Router, TypeScript, Tailwind e Supabase PostgreSQL/Auth/Broadcast privado. O jogo é comandado por funções SQL transacionais. Não há backend de demonstração no produto.

## Executar

Node.js 22.13+ e npm.

```sh
npm ci
cp .env.example .env.local
# Configure URL e publishable key do seu Supabase.
npm run dev
```

No Windows: `Copy-Item .env.example .env.local`. Abra [localhost](http://127.0.0.1:3000). Sem configuração, a home informa a indisponibilidade e desabilita criar/entrar.

## Configurar Supabase

1. Crie um projeto próprio ou instale Docker + Supabase CLI e execute `supabase start` para desenvolvimento local. Este ambiente não tinha Docker/CLI/credenciais.
2. Aplique todas as migrações de `supabase/migrations/` em ordem no SQL Editor ou execute `supabase db push` após `supabase link --project-ref SEU_REF`.
3. O catálogo oficial existe somente no banco privado. Não há carga de perguntas no repositório. Bancos novos precisam de importação administrativa privada; `npm run seed` exige `SUPABASE_DB_URL`, `psql` e `ARRISCAI_PRIVATE_SEED_SQL` apontando para um arquivo fornecido pelo responsável fora do repositório. Não exporte o catálogo para docs, capturas ou commits.
4. Habilite Anonymous Sign-ins e Email/Password. Configure confirmação de e-mail, Site URL e Redirect URLs para a origem do app. Use senha mínima de 12 caracteres. Configure limites do Auth e CAPTCHA antes de acesso público irrestrito.
5. Habilite Realtime privado; desabilite canais públicos nas configurações do Realtime. As policies de `realtime.messages` estão na migration. Não publique tabelas privadas nem exponha o schema `private` na Data API.
6. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. O app não usa service role.

O catálogo e sua aprovação editorial são administrados na base. Quantidade, distribuição e disponibilidade devem ser verificadas por consultas administrativas privadas. Somente para ambiente PRIVADO de desenvolvimento, execute como administrador:

```sql
update private.settings set allow_provisional = true where singleton;
```

Antes do lançamento, volte para `false` e marque somente perguntas efetivamente revisadas como `approved`. Não basta trocar o status em lote. Veja [conteúdo](docs/CONTEUDO.md).

## Jogar

Crie sala com apelido e compartilhe convite/código. O host escolhe organizador manualmente ou por sorteio. Convide ao menos um jogador. Prepare categorias, de 1 a 8 rodadas e tamanho, com seleção automática proporcional à dificuldade (50% fáceis, 35% médias e 15% difíceis, conforme estoque). Seleção manual de perguntas e modo misto estão temporariamente desativados, inclusive na API. O catálogo fecha durante a partida.

Na preparação, 2 minutos sem heartbeat expiram a participação. A limpeza ocorre nos heartbeats de 15 segundos e nas consultas, entradas, trocas de organizador e início da partida. A pessoa deve entrar novamente pelo convite/código. Se o organizador expirar, o jogador elegível mais antigo assume; se todos expirarem, a próxima entrada de jogador recupera a organização. Partidas ativas preservam seus participantes e regras de pausa. Desempates continuam usando a reserva além das rodadas programadas.

O host seleciona posição, confirma revelação, registra o palpite oral e confirma acerto/erro. A comparação é sugestão. Pode registrar desistência, pausar, retomar, desfazer antes do palpite ou pular desconectado após 45 s. Avanço e encerramento são manuais. Empates usam perguntas inéditas extras. Nova partida zera o placar e permite trocar o host.

Telão abre com identidade anônima separada, inclusive no mesmo navegador, e permanece espectador na partida seguinte. Jogador que chega tarde entra no próximo jogo.

Para perguntas próprias, entre na conta ANTES de entrar na sala. Criar conta usa `updateUser` para preservar UID do visitante; confirme o e-mail quando solicitado. Login de conta existente muda o UID: entre de novo na sala com o código.

## Verificar

```sh
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npx playwright install chromium
npm run test:e2e
```

No Windows restrito, se o Vitest falhar ao renomear temporários, aponte TEMP/TMP para pasta gravável no projeto. Webpack está explícito nos scripts porque Turbopack não iniciou um subprocesso neste ambiente.

`test:db` executa migrations em PGlite com um catálogo inteiramente fictício, schemas Auth/Realtime simulados e grants/RLS/RPC reais. Os testes não importam o catálogo oficial nem comprovam sua revisão editorial ou estoque no banco hospedado. O Playwright usa contextos Chromium conectando a UI ao SQL por adaptador exclusivo de testes. **Isso não valida o serviço Supabase hospedado.** O adaptador não é importado pela aplicação nem empacotado no deploy.

Para rodar o mesmo fluxo contra Supabase real: configure as duas variáveis públicas no shell, `ARRISCAI_LIVE_E2E=1`, habilite questões revisadas ou provisórias somente no projeto de teste privado e execute `npm run test:e2e`. Não use produção: o teste cria identidades, sala e partidas. Veja [relatório](docs/TESTES.md).

## Vercel

Importe o repositório como Next.js. Build `npm run build`, instalação `npm ci`. Configure as duas variáveis públicas em Production e Preview com projetos Supabase separados. Redeploy após alterar variáveis públicas. Configure origem/redirect de produção no Supabase Auth. Execute três contextos contra o serviço real antes de liberar o domínio.

Veja [segurança e operação](docs/SEGURANCA.md). Nenhum deploy foi realizado. Projeto/credenciais Supabase e Vercel, revisão editorial, Rufing licenciada e verificação de marca continuam externos.

O conteúdo oficial fica somente na base privada. Veja [privacidade do catálogo e limite do histórico Git](docs/PRIVACIDADE_CATALOGO.md).
