# Palpites dos jogadores e condução da partida — 18/11/2026

## Comportamento

- O jogador da vez envia seu palpite pelo próprio dispositivo, após a revelação confirmada. O texto aparece brevemente para toda a sala. A resposta oficial e a comparação automática continuam restritas ao organizador até o encerramento da rodada.
- O organizador confirma acerto ou erro. A comparação é apenas uma sugestão; não concede pontos automaticamente. O registro de um palpite falado continua disponível.
- Um erro confirmado gera aviso visual e som nos dispositivos com som habilitado. Movimento reduzido substitui a animação por aviso estático. Reconectar não repete eventos antigos.
- O organizador alterna entre Rodada, Placar e Ajustes. Em telas pequenas, alterna também entre Tabuleiro e Condução. Tabuleiro, placar, pergunta secreta e palpites longos têm paginação explícita; nenhuma posição ou trecho é descartado.
- O resultado separa nome do vencedor, recompensa, resposta e pergunta. A regra de pontuação N − k + 1 permanece igual; erros não subtraem pontos já acumulados.

## Banco e publicação

Migration incremental: `supabase/migrations/202611180002_player_guesses.sql`.

Ela redefine somente a implementação privada de `game_command`, preservando o wrapper público, ACL, bloqueio da sala, versão, idempotência e notificações privadas. `submit_guess` exige membro participante, identidade do jogador da vez, fase adequada, partida ativa e texto de 1 a 200 caracteres. Um palpite pendente impede outro envio. O estado compartilhado recebe apenas o texto enviado e os eventos de apresentação; comparação e aliases continuam privados.

Aplicar pelo pipeline normal de migrations **primeiro em Preview/homologação** e validar o serviço hospedado antes de publicar o frontend. Esta implementação não depende de configuração editorial na sessão. A operação editorial privada da Q0710 continua separada, conforme sua documentação existente.

Nenhuma migration foi aplicada remotamente neste trabalho. Não houve push, merge ou deploy. Produção permanece sem estas mudanças até a publicação e aplicação da migration.

## Validação e limites

Os testes de navegador usam Chromium real, seis contextos independentes, SQL local em PGlite e Auth/Realtime simulados. Isso não comprova o Supabase hospedado. Apenas conteúdo fictício é utilizado; capturas e logs ficam em `.tmp/`, fora do Git.

Cobertura automatizada:

- `tests/e2e/player-guesses.spec.ts`: organizador, três jogadores e dois telões; envio, julgamento, aviso em todos os contextos, áudio habilitado/desabilitado, movimento reduzido, reconexão, texto de 200 caracteres, todas as 22 posições e resultado com +21 após duas revelações.
- Layout sem rolagem do organizador em 320×720, 390×844, 430×932, 768×1024, 1360×768, 1440×900 e 1920×1080. Input e botão do registro falado visíveis com viewport reduzido a 390×500, simulando a perda de altura para teclado.
- `tests/e2e/game.spec.ts` e `tests/e2e/homologation-fixes.spec.ts`: regressões de partidas, histórico, +22/+19/+1/zero, nova partida zerada, empate, duas rodadas extras, concorrência, reconexões e dois telões fora do rodízio.
- Axe no resultado para organizador, jogador e telão; inspeção visual de capturas desktop e mobile.
- `npm run test:guesses`: autorização, tipos e tamanho de input, fases, pausa, concorrência, repetição idempotente, conflito de versão, privacidade, julgamento humano, pontos e reset.
- `npm run test:migrations`: upgrade e replay do schema, guardas e ACL da operação editorial privada. `npm run test:db`: regressão geral de SQL.

Não foram validados teclado virtual em dispositivo físico, Firefox/WebKit, expiração de JWT, sessão de várias horas ou este novo fluxo no Supabase hospedado. Acesso permanente e recuperação de conta continuam fora da homologação completa. Não se declara homologação integral nem produção corrigida.

## Resultado dos checks locais

- Build de produção, ESLint e TypeScript: aprovados.
- Vitest: 24 testes aprovados em 6 arquivos. O prazo do teste de hashes do catálogo foi ampliado de 5 para 15 segundos devido ao crescimento do código; a varredura e todas as asserções permanecem integrais.
- SQL geral: 28 checks aprovados. Palpites, dificuldade e upgrade/migrations: aprovados.
- Os três cenários E2E citados acima foram aprovados em Chromium, com zero violações Axe nos resultados avaliados e sem erros JavaScript registrados.
- Capturas atuais e relatório de apresentação: `.tmp/player-guesses/`; regressão de homologação: `.tmp/catalog-privacy/e2e/`; logs dos comandos: `.tmp/player-flow-*.txt`. Esses arquivos locais ignorados não são necessários para executar a aplicação e não foram adicionados ao repositório.
