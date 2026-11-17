# Conteúdo provisório

## Dificuldade

O catálogo atual contém 504 perguntas, 63 por categoria, classificadas por complexidade estimada em 17/11/2026. O [ranking completo](RANKING_DIFICULDADE.md) documenta critérios, notas, níveis e distribuição por categoria. A dificuldade não muda o status editorial provisório. Perguntas próprias e itens sem avaliação recebem nível médio, sem nota de complexidade. O catálogo retorna `difficulty`, sem expor respostas.

As migrações `202611170002` e `202611170003` adicionam a classificação e a seleção proporcional (50/35/15). A migração `202611170004` insere 264 novas perguntas sem substituir IDs existentes. A `202611170005` limita a preparação e os ajustes a 1–8 rodadas e desativa temporariamente os modos manual e misto na API. Filtros, reserva de desempate e snapshots existentes são preservados. A atualização dos níveis dos itens originais exige correspondência de ID, texto e resposta para preservar curadoria remota divergente. Validação: `npm run test:difficulty`, `npm test` e `npm run test:db`. O ranking não inclui itens exclusivos de um banco remoto.

JSON original preservado em `data/perguntas_240_original.json`; `data/perguntas_240.json` mantém a base histórica com os três ajustes abaixo. A fonte da expansão é `data/perguntas_expansao.txt`. Execute `node scripts/rank-questions.mjs` para gerar o catálogo consolidado `data/perguntas_504.json`, seed, migração de expansão e ranking. Não há interrogações armazenadas; cada pergunta tem de 1 a 22 palavras. Uma categoria + 22 palavras + 8 rodadas continua sendo recusada quando só existem seis itens elegíveis.

As perguntas geradas permanecem `provisional`, assim como as originais. A expansão não habilita `allow_provisional` nem promove aprovação editorial em lote. O JSON não entra no bundle web. Consultas pontuais de referência para a expansão: [biatlo, União Internacional de Biatlo](https://www.biathlonworld.com/discover-biathlon/how-it-works/rules-overview), [Audrey Tautou como Amélie, Festival de Cannes](https://www.festival-cannes.com/en/f/le-fabuleux-destin-d-amelie-poulain/). Essas verificações não equivalem à revisão factual integral do catálogo.

Correções iniciais em 13/11/2026, mantendo respostas, aliases e status provisório:

| ID | Problema |
|---|---|
| Q0505 | Gramática corrigida para “com áreas tanto na Europa quanto na Ásia”. Mantém 22 palavras. |
| Q0515 | Explicita a divisão da América em subcontinentes, evitando depender da convenção “continente”. 12 palavras. Referência territorial: [IBGE](https://www.ibge.gov.br/apps/quadrogeografico/pdf/qg_2024_000_Brasil.pdf). |
| Q0721 | Especifica dois pontos da escala, água pura e pressão de uma atmosfera, evitando outras escalas com zero no congelamento. 19 palavras. Referência: [IAPWS](https://iapws.org/faqs/faq1), [NIST](https://www.nist.gov/pml/owm/si-units-temperature). |

Não houve promoção automática de status. A revisão editorial integral ainda exige responsável humano e fontes por item. Ao mudar tamanho, atualizar `word_count` e reexecutar validação, mantendo 30/categoria e o estoque do filtro 22 se esse contrato continuar. Para bancos que já receberam o seed anterior, aplicar as correções explicitamente por ID após revisão; a carga repetível não sobrescreve dados existentes.

Armazenamento remove interrogações; UI acrescenta uma única `?` após a última palavra. Sem tile para sinal isolado. Perguntas próprias ficam disponíveis apenas ao autor permanente antes da partida; snapshots existentes não são editados.
