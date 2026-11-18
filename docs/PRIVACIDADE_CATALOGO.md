# Privacidade do catálogo — 18/11/2026

O catálogo oficial não é distribuído na árvore atual do repositório. Não houve alteração, exportação ou exclusão de registros no banco hospedado.

## Remoções

- JSONs históricos e consolidados e arquivo textual de expansão em `data/`.
- Enunciados e respostas do ranking de dificuldade e do gerador de catálogo.
- Perguntas embutidas no seed, nas migrations de expansão e na correção editorial. A classificação conserva somente metadados e fingerprints combinados, sem textos ou hashes isolados de respostas curtas.
- Capturas, vídeos, galerias e snapshots de documentação que poderiam expor tabuleiros, respostas, biblioteca ou consultas do organizador. Resumos de aprovação/reprovação e limitações históricas foram mantidos, com aviso sobre as remoções.
- Citações do conteúdo real nos relatórios e nas instruções operacionais.

## Funcionamento preservado

O frontend continua consultando o catálogo no banco por RPCs autorizadas, com schema privado, RLS e ocultação de respostas preservados. Não há alteração de interface ou de regras do jogo nesta limpeza.

As versões das migrations foram preservadas. Isso não reexecuta SQL em bases já instaladas. Bases novas não recebem um catálogo embutido: dependem de importação administrativa privada. A correção editorial pendente usa uma função administrativa instalada pela migration `202611180001`, separada do deploy, que recebe o texto aprovado privadamente e valida fingerprints antes de escrever. A versão `202611170007` não exige mais entrada privada durante o pipeline. Ver [operação do conteúdo privado](CONTEUDO.md).

Os testes locais passaram a usar itens inteiramente fictícios, identificados como QA, gerados por `scripts/test-catalog-fixtures.mjs`. Quantidades, dificuldades, palavras longas e reservas são cenários de teste; não constituem inventário ou validação editorial da base real. Os artefatos de novos testes ficam em `.tmp/`, ignorado pelo Git.

## Proteções contra reintrodução

`tests/catalog-privacy.test.ts` verifica os enunciados conhecidos por fingerprints SHA-256 sem armazenar seus textos, a ausência das cópias de dados e de capturas de docs. Também testa a recusa de importação administrativa a partir de arquivo dentro do repositório. `.gitignore` bloqueia os caminhos antigos de catálogo e os caminhos previstos de payload privado.

A importação privada continua sendo opcional e administrativa: exige arquivo fornecido fora do repositório e credenciais do ambiente autorizado. Nenhum payload privado foi criado por esta limpeza. Os registros atuais do serviço permanecem intocados.

## Limite importante

**O histórico Git ainda contém as versões antigas.** Remover arquivos em um novo commit não elimina conteúdo de commits anteriores, clones, caches, anexos ou outros serviços. Não houve reescrita de histórico, force push, push ou alteração da visibilidade do repositório. Uma purga histórica completa exige coordenação separada.

## Validação

Resultados dos checks e regressões desta limpeza estão no relatório de execução da sessão. Os checks de regras, SQL e multiplayer usam apenas fixtures sintéticas. Nenhum teste daqui deve ser apresentado como comprovação do catálogo oficial ou do Supabase hospedado.

| Check | Resultado |
|---|---|
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm test` | 24 testes em seis arquivos passaram, incluindo privacidade e importação privada |
| `npm run test:db` | 28 verificações passaram |
| `npm run test:migrations` | Passou, preservando dados e histórico de teste |
| `npm run test:difficulty` | Passou com itens fictícios |
| `node scripts/test-homologation-fixes.mjs` | Passou; recusa de entrada editorial não aprovada ocorre somente na função administrativa, não na migration |
| Regressão multiplayer local | Passou com fixtures: quatro rodadas, pontos 22/19/1/zero, duas extras, reset, reconexões e rodadas mobile com três/cinco jogadores |

A regressão de interface utilizou o build local compilado que já existia, pois esta limpeza não altera o frontend. Para não incorporar alterações simultâneas de copy/interface, a execução usou uma cópia temporária do spec compatível com esse build; o adaptador SQL foi o atual, já sem catálogo real. As demais alterações simultâneas foram preservadas fora do commit desta limpeza.
