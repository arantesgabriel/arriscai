# Catálogo privado

O conteúdo oficial de perguntas, respostas e aliases é administrado exclusivamente na tabela `private.questions`. O repositório contém schema, regras, validações e testes fictícios. Não contém o catálogo, ranking por enunciado ou exportações de produção.

## Operação

- Não publicar dumps, JSONs, SQL com conteúdo, capturas de rodadas reais, respostas, aliases ou previews do organizador em issues, PRs, docs ou logs.
- Importações excepcionais exigem um payload privado fornecido pelo responsável e `SUPABASE_DB_URL` do ambiente autorizado. `npm run seed` lê `ARRISCAI_PRIVATE_SEED_SQL` somente fora do repositório; não gera exportação nem possui conteúdo embutido.
- O seed automático do Supabase fica desativado. Executar migrations em uma base vazia cria o schema, não o estoque oficial. Bases já populadas conservam seus registros.
- Aprovação editorial, dificuldade, contagem de palavras e fontes devem ser revisadas na base ou em ferramenta administrativa privada. Não promover itens em lote para facilitar testes.
- Respostas e aliases permanecem protegidos no schema privado e nas RPCs autorizadas. Não expor o schema pela Data API nem incluir segredos em snapshots de jogadores.

## Migrations históricas e patches

Os identificadores das migrations foram preservados, mas os payloads de catálogo foram retirados por confidencialidade. A migration de dificuldade usa fingerprints combinados de enunciado e resposta para preservar a guarda editorial sem divulgar os textos. A antiga expansão não distribui mais perguntas: bases novas dependem de importação privada.

A versão `202611170007_private_editorial_patch.sql` é somente um marcador histórico, sem payload ou exigência de variável de sessão. A migration `202611180001_private_editorial_operation.sql` instala a função `private.apply_q0710_editorial_patch(text)`; nenhuma delas modifica o catálogo durante o deploy. Isso permite que Preview e CI executem as migrations sem acesso ao conteúdo editorial privado.

A correção do registro é uma operação administrativa posterior, separada do deploy. O responsável fornece o texto aprovado como parâmetro da função, por uma conexão administrativa privada e parametrizada. A função não é acessível a `PUBLIC`, `anon` ou `authenticated`, não é `SECURITY DEFINER` e mantém `search_path` vazio. Valida fingerprints do novo texto e do registro anterior (categoria, enunciado, resposta e aliases), além de exigir ausência de dono. Retorna `true` quando corrige e `false` quando o texto já está corrigido. Entrada não aprovada ou registro ausente/divergente causa erro sem alterações.

O sucesso das migrations **não significa que a correção editorial foi aplicada**. A conferência e a execução dessa operação privada continuam sendo uma pendência própria; não usar `migration repair`, reset ou mudança manual do histórico para contornar falhas.

`scripts/catalog-correction.mjs` fornece a operação parametrizada para correções editoriais privadas, com guardas de ID, dono, categoria, texto anterior, resposta e aliases. O módulo não inclui nenhum payload e não é importado pelo frontend.

## Testes

`scripts/test-catalog-fixtures.mjs` gera itens fictícios identificados como QA. Mantém cenários de 1–22 palavras, palavras longas, dificuldades, filtros, quotas, reserva e pontuação. Esses itens não são o catálogo oficial e nunca devem ser importados em serviço hospedado.

`tests/catalog-privacy.test.ts` procura reintrodução dos enunciados conhecidos através de fingerprints sem texto, bloqueia cópias do catálogo em `data/` e capturas de documentação. Artefatos de novos testes ficam em `.tmp/`, ignorado pelo Git. Para validar o conteúdo real, usar consultas administrativas privadas; testes fictícios não comprovam qualidade ou quantidade do acervo de produção.

## Limite da remoção

A limpeza remove as cópias da árvore atual. Commits antigos, clones, caches e anexos externos podem conservar versões anteriores. Este trabalho não reescreve histórico, não faz force push e não altera registros do banco. Uma purga histórica exige um procedimento coordenado separado.
