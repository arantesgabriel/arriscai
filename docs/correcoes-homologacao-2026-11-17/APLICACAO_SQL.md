# Aplicação das correções de banco B03 e B04

> Privacidade do catálogo (18/11/2026): esta cópia histórica teve enunciados, respostas, arquivos de dados e capturas removidos. Resultados anteriores foram preservados como histórico, não como nova homologação; instruções de catálogo devem seguir `docs/CONTEUDO.md`.

SQL preparado e testado localmente. **Não aplicado em produção nem no Supabase dev nesta execução.** Os testes PostgreSQL embarcados não certificam o Supabase hospedado.

## Arquivos e ordem

1. `supabase/migrations/202611170006_display_names.sql`: substitui somente a fachada `public.join_room`, mantendo a trava da sala, pruning, função privada, throttle, capacidade, permissões e constraint de apelidos. Para telões novos, resolve nomes ocupados com sufixos (`Telão 2`, `Telão 3`). Reconexões preservam o nome da identidade existente. Jogadores continuam recebendo erro por apelido duplicado.
2. `supabase/migrations/202611170007_private_editorial_patch.sql`: altera somente o enunciado conhecido do registro oficial Q0710. Confere ID, ausência de dono, categoria, texto anterior, resposta e aliases. Uma versão posterior ou inesperada não é sobrescrita. Review status, dificuldade e complexidade não são alterados. Decks e históricos existentes permanecem como snapshots.

Nenhuma migration anterior deve ser reexecutada. Alterar ou reaplicar o seed não substitui a migration de conteúdo.

## Procedimento operacional

Atualização de privacidade: a migration `202611170007_private_editorial_patch.sql` não distribui o texto aprovado. Para registro ainda não corrigido, configurar `arriscai.editorial_q0710` na sessão administrativa privada antes de executar esse SQL, na mesma sessão. A entrada é validada por fingerprint; ausência ou divergência falha sem alterações. Não aplicar esse patch automaticamente sem preparar a entrada privada nem marcar a versão como aplicada à força. As instruções atuais de conteúdo estão em `docs/CONTEUDO.md`.

Primeiro concluir em homologação; produção requer autorização específica posterior, fora deste trabalho.

1. Confirmar a referência do projeto e o histórico de migrations. O projeto dev documentado é `ksouiyjszsfrqrurpepq`; produção é `ltrlsiqlvbjyfdoyotdd`. Confirmar backup e acesso TLS com CA confiável. Não desabilitar validação de certificado como substituto.
2. Consultar Q0710 e comparar com a guarda do SQL:

   ```sql
   select id, owner_id, category, question, answer, aliases,
          review_status, difficulty, complexity_score,
          cardinality(private.tokens(question)) as word_count
   from private.questions where id = 'Q0710';
   ```

3. Revisar a lista de migrations pendentes. Pelo procedimento existente no README, usar `supabase db push` **somente após conferir o vínculo com o projeto autorizado e a lista de pendências**. Alternativamente, executar no SQL Editor os dois arquivos novos em ordem, cada um em transação, e registrar a execução no controle de migrations adotado pelo projeto. Não usar `db reset`, seed em massa ou alterações destrutivas.
4. Repetir a consulta de Q0710. Esperado: `[enunciado omitido por privacidade]`, resposta `[resposta omitida]`, aliases `["[alias omitido]"]`, **11 palavras**, demais atributos preservados. O cliente acrescenta a interrogação. Se a atualização atingir zero linhas, verificar se o texto já está corrigido; caso contrário, interromper a publicação da correção editorial para revisar a divergência. Não remover a guarda para forçar o update.
5. Conferir permissões de `public.join_room(text,text,boolean)`: autenticados podem executar; `anon` e `PUBLIC` não. A função continua `SECURITY DEFINER` com `search_path` vazio. A constraint `unique(room_id,nickname)` permanece.
6. Com identidades Auth independentes, entrar simultaneamente com dois telões, inclusive com `Telão`/`Telão 2` ocupados, reconectar, iniciar outra partida e confirmar `display_only=true`, `spectator=true` e ausência de seus IDs no rodízio. Conferir sincronização privada e repetir a regressão de pontuação/concorrência.

## Testes disponíveis

- `node scripts/test-homologation-fixes.mjs`: atualização de registro existente, repetição, preservação de texto/aliases/resposta/categoria/dono divergentes, alocação de apelidos, nome longo de 24 caracteres, reconexão e unicidade de jogador.
- `npm run test:migrations`: upgrade de banco já povoado com Q0710 antiga e aprovada; preserva aprovação, histórico, empate e curadoria anterior.
- `npm run test:db`: regressão SQL existente. Definir `ARRISCAI_DB_REPORT` para gravar em um diretório novo e preservar evidências anteriores.

Esses testes usam PGlite, com Auth e transporte Realtime simulados. A serialização desse runtime não demonstra concorrência com conexões independentes no PostgreSQL hospedado.

## Situação do acesso dev

A conexão direta falhou com `ENOTFOUND`. O pooler do projeto dev vinculado apresentou `SELF_SIGNED_CERT_IN_CHAIN`, também com a CA do sistema. Não houve escrita remota. Evidências: `evidencias/staging-probe.txt`, `staging-pooler-probe.txt` e `staging-system-ca-probe.txt`.
