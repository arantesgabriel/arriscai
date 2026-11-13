# Conteúdo provisório

JSON original preservado em `data/perguntas_240_original.json`. A versão de carga em `data/perguntas_240.json` tem três ajustes abaixo. Seed derivado com `ON CONFLICT DO NOTHING`, sem sobrescrever curadoria. 240 IDs e textos únicos, oito categorias de 30; seis questões de 22 palavras por categoria. Uma categoria + 22 palavras + 12 rodadas é recusada por insuficiência.

Não houve revisão factual individual das 240 questões. Publicação bloqueada por `allow_provisional=false` e `review_status=provisional`. O JSON não entra no bundle web.

Correções iniciais em 13/11/2026, mantendo respostas, aliases e status provisório:

| ID | Problema |
|---|---|
| Q0505 | Gramática corrigida para “com áreas tanto na Europa quanto na Ásia”. Mantém 22 palavras. |
| Q0515 | Explicita a divisão da América em subcontinentes, evitando depender da convenção “continente”. 12 palavras. Referência territorial: [IBGE](https://www.ibge.gov.br/apps/quadrogeografico/pdf/qg_2024_000_Brasil.pdf). |
| Q0721 | Especifica dois pontos da escala, água pura e pressão de uma atmosfera, evitando outras escalas com zero no congelamento. 19 palavras. Referência: [IAPWS](https://iapws.org/faqs/faq1), [NIST](https://www.nist.gov/pml/owm/si-units-temperature). |

Não houve promoção automática de status. A revisão editorial integral ainda exige responsável humano e fontes por item. Ao mudar tamanho, atualizar `word_count` e reexecutar validação, mantendo 30/categoria e o estoque do filtro 22 se esse contrato continuar. Para bancos que já receberam o seed anterior, aplicar as correções explicitamente por ID após revisão; a carga repetível não sobrescreve dados existentes.

Armazenamento remove interrogações; UI acrescenta uma única `?` após a última palavra. Sem tile para sinal isolado. Perguntas próprias ficam disponíveis apenas ao autor permanente antes da partida; snapshots existentes não são editados.
