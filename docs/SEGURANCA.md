# Segurança e operação

- Gateway Supabase valida JWT. RPC usa `auth.uid()` e `auth.jwt()`. Anônimo tem role `authenticated`; autoria exige `is_anonymous=false` explicitamente.
- Schema privado fora da Data API. Cliente não tem grants de tabelas/funções privadas, exceto helper de membership. Tabelas privadas com RLS sem policies de cliente.
- Estado público não tem IDs de perguntas, respostas, aliases, deck ou palpites. Resultado permite pergunta completa sem resposta/aliases.
- Host consulta material privado só por RPC autorizada, apenas da rodada atual. Catálogo fechado durante partida ativa.
- `game_command` tranca sala `FOR UPDATE`, valida identidade/membership, partida, fase, jogador atual, versão e idempotência. Estado, pontos, auditoria e Broadcast na mesma transação. Chave reutilizada com payload diferente é recusada.
- Broadcast privado só contém `room_id`. Policies autorizam tópico exato por membership. Cliente pode publicar apenas Presence.
- Reconexão refaz snapshot autorizado e assinatura privada. Heartbeat 15 s; host ausente 45 s pausa. Pulo valida ausência no servidor, sem confiar em Presence.
- Telão tem storageKey própria, `display_only` e não compete. Nenhuma chave de host no link.
- Funções definer com `search_path=''` e referências qualificadas. Browser só usa publishable key.

## Antes do público

Configurar limites por IP no gateway e CAPTCHA no Auth anônimo. O contador SQL limita operações bem-sucedidas por usuário/minuto. Erros abortam também o contador; ele **não substitui** proteção de borda contra adivinhação de códigos e criação de identidades. Código tem oito caracteres hexadecimais e exige sessão.

Testar SMTP/confirmação, rotação de chaves e alertas de custo/erro. Recuperação de senha ainda não tem UI. CSP permite scripts inline para hidratação Next.js e unsafe-eval somente em desenvolvimento. Nonce/hash seria endurecimento adicional. Frame-ancestors, nosniff, referrer e permissions policies já configuradas.

Definir retenção de salas, palpites privados, histórico e auditoria. Ainda não há job de expiração; não prometer retenção indefinida.

## Limites

Host só muda entre partidas. Se acabar a reserva no desempate, vitória fica bloqueada. Pode preparar outra questão inédita do catálogo; uma conta permanente também pode cadastrar a próxima questão pelo formulário especial de desempate. Isso ocorre antes de abrir a rodada extra e não permite alterar uma rodada já iniciada.

No ambiente desta execução, SQL/RLS testados em PostgreSQL embarcado. JWTs reais, SMTP, autorização WebSocket hospedada e contenção entre conexões independentes ainda exigem projeto Supabase. Não homologar para público antes disso.

Referências: [Anonymous Sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization), [Next.js](https://nextjs.org/docs/app/getting-started/installation), e documentação empacotada em `node_modules/next/dist/docs`.
