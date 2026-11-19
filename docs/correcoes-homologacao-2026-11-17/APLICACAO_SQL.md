# Aplicação das correções de banco B03 e B04

> Privacidade do catálogo (18/11/2026): esta cópia histórica teve enunciados, respostas, arquivos de dados e capturas removidos. Resultados anteriores foram preservados como histórico, não como nova homologação; instruções de catálogo devem seguir `docs/CONTEUDO.md`.

SQL preparado e testado localmente. **Não aplicado em produção nem no Supabase dev nesta execução.** Os testes PostgreSQL embarcados não certificam o Supabase hospedado.

## Arquivos e ordem

1. `supabase/migrations/202611170006_display_names.sql`: substitui somente a fachada `public.join_room`, mantendo a trava da sala, pruning, função privada, throttle, capacidade, permissões e constraint de apelidos. Para telões novos, resolve nomes ocupados com sufixos (`Telão 2`, `Telão 3`). Reconexões preservam o nome da identidade existente. Jogadores continuam recebendo erro por apelido duplicado.
2. `supabase/migrations/202611170007_private_editorial_patch.sql`: marcador histórico sem alteração de conteúdo. Não exige entrada privada no pipeline.
3. `supabase/migrations/202611180001_private_editorial_operation.sql`: instala a operação administrativa privada, sem executá-la. A correção editorial continua pendente até sua execução explícita pelo responsável. Confere ID, ausência de dono e fingerprints do novo texto e do registro anterior. Versões divergentes, review status, dificuldade, complexidade, decks e históricos não são sobrescritos.

Nenhuma migration anterior deve ser reexecutada. Alterar ou reaplicar o seed não substitui a migration de conteúdo.

## Procedimento operacional

Atualização para Preview/CI: migrations não recebem nem exigem texto editorial. Após elas, o responsável pode executar `private.apply_q0710_editorial_patch(text)` por conexão administrativa privada, passando o texto aprovado como parâmetro. A função valida o conteúdo e pode falhar, mas isso não bloqueia mais o deploy de schema. Não compartilhar o parâmetro em Git, logs ou exemplos públicos. As instruções atuais estão em `docs/CONTEUDO.md`.

Primeiro concluir em homologação; produção requer autorização específica posterior, fora deste trabalho.

1. Confirmar a referência do projeto e o histórico de migrations. O projeto dev documentado é `ksouiyjszsfrqrurpepq`; produção é `ltrlsiqlvbjyfdoyotdd`. Confirmar backup e acesso TLS com CA confiável. Não desabilitar validação de certificado como substituto.
2. Consultar Q0710 e comparar com a guarda do SQL:

   ```sql
   select id, owner_id, category, question, answer, aliases,
          review_status, difficulty, complexity_score,
          cardinality(private.tokens(question)) as word_count
   from private.questions where id = 'Q0710';
   ```

3. Revisar a lista de migrations pendentes. Pelo procedimento existente no README, usar `supabase db push` **somente após conferir o vínculo com o projeto autorizado e a lista de pendências**. O pipeline pode aplicar `202611170007` e `202611180001` sem entrada editorial, inclusive com o registro antigo presente. Depois, executar a operação editorial separadamente, se autorizada. Não usar `db reset`, seed em massa, reparo do histórico ou alterações destrutivas.
4. Após a operação administrativa, repetir a consulta privada de Q0710 e conferir o texto aprovado, **11 palavras** e demais atributos preservados. O cliente acrescenta a interrogação. A função retorna `true` quando aplica e `false` quando o texto já está corrigido; entrada ou registro divergentes causam erro. Não remover as guardas nem confundir sucesso da migration com aplicação da correção editorial.
5. Conferir permissões de `public.join_room(text,text,boolean)`: autenticados podem executar; `anon` e `PUBLIC` não. A função continua `SECURITY DEFINER` com `search_path` vazio. A constraint `unique(room_id,nickname)` permanece.
6. Com identidades Auth independentes, entrar simultaneamente com dois telões, inclusive com `Telão`/`Telão 2` ocupados, reconectar, iniciar outra partida e confirmar `display_only=true`, `spectator=true` e ausência de seus IDs no rodízio. Conferir sincronização privada e repetir a regressão de pontuação/concorrência.

## Testes disponíveis

- `node scripts/test-homologation-fixes.mjs`: atualização de registro existente, repetição, preservação de texto/aliases/resposta/categoria/dono divergentes, alocação de apelidos, nome longo de 24 caracteres, reconexão e unicidade de jogador.
- `npm run test:migrations`: upgrade com registro fictício já presente, sem entrada editorial; preserva catálogo, histórico, empate e curadoria anterior. Também valida a operação administrativa com fingerprints fictícios, incluindo permissões, repetição e divergências.
- `npm run test:db`: regressão SQL existente. Definir `ARRISCAI_DB_REPORT` para gravar em um diretório novo e preservar evidências anteriores.

Esses testes usam PGlite, com Auth e transporte Realtime simulados. A serialização desse runtime não demonstra concorrência com conexões independentes no PostgreSQL hospedado.

## Situação do acesso dev

A conexão direta falhou com `ENOTFOUND`. O pooler do projeto dev vinculado apresentou `SELF_SIGNED_CERT_IN_CHAIN`, também com a CA do sistema. Não houve escrita remota. Evidências: `evidencias/staging-probe.txt`, `staging-pooler-probe.txt` e `staging-system-ca-probe.txt`.
