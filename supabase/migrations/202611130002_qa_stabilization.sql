-- Migration incremental: Estabilização QA (P1/P2)
-- 1. Metadados de histórico e roleta sincronizada
-- 2. Projeção segura da resposta correta apenas quando phase = 'result'
-- 3. Pontos conquistados na rodada (round_points) sem exibir 1 ponto em jogo após encerramento
-- 4. Conversão de espectadores tardios em elegíveis no cancelamento (preservando display_only do telão)
-- 5. Preview privado de pergunta/resposta para o organizador fora de partida ativa
-- 6. Preservação de filtros prévios no comando reserve com fallback quando filtro específico esgotar

alter table public.rooms add column if not exists roulette jsonb;

alter table public.room_match_history
  add column if not exists winner_id uuid,
  add column if not exists winner_nickname text,
  add column if not exists host_id uuid,
  add column if not exists host_nickname text,
  add column if not exists total_rounds integer not null default 1;

-- Recover legacy history from the idempotent action log where possible.
-- A tie remains without a winner; rows without actions keep their safe defaults.
with action_rounds as (
  select match_id, count(*) filter (where command = 'next')::integer as total_rounds
  from private.actions
  group by match_id
), first_host as (
  select distinct on (match_id) match_id, actor
  from private.actions
  order by match_id, created_at, version, key
)
update public.room_match_history h
set total_rounds = greatest(1, coalesce(ar.total_rounds, 1)),
    host_id = coalesce(h.host_id, fh.actor),
    host_nickname = coalesce(
      h.host_nickname,
      (select m.nickname from public.room_members m where m.room_id = h.room_id and m.user_id = fh.actor limit 1),
      case when fh.actor is null then null else 'Organizador' end
    )
from action_rounds ar
left join first_host fh using (match_id)
where h.id = ar.match_id;

with scored as (
  select h.id as history_id,
         p->>'id' as player_id,
         p->>'nickname' as nickname,
         case when p->>'score' ~ '^-?[0-9]+$' then (p->>'score')::bigint end as score
  from public.room_match_history h
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(h.scores) = 'array' then h.scores else '[]'::jsonb end
  ) p
), ranked as (
  select *, rank() over (partition by history_id order by score desc nulls last) as position
  from scored
  where score is not null
), unique_winners as (
  select history_id,
         (array_agg(player_id))[1] as player_id,
         (array_agg(nickname))[1] as nickname
  from ranked
  where position = 1
  group by history_id
  having count(*) = 1
)
update public.room_match_history h
set winner_id = case
      when uw.player_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then uw.player_id::uuid
      else h.winner_id
    end,
    winner_nickname = coalesce(h.winner_nickname, uw.nickname)
from unique_winners uw
where h.id = uw.history_id
  and h.winner_id is null;

alter table private.decks
  add column if not exists filters jsonb not null default '{}'::jsonb;

create or replace function private.round_state(g jsonb, q jsonb, idx integer)
returns jsonb
language plpgsql
immutable
set search_path=''
as $$
declare words jsonb;
begin
 select jsonb_agg('null'::jsonb) into words from unnest(private.tokens(q->>'question'));
 return g||jsonb_build_object(
   'round', idx,
   'phase', 'awaiting_position',
   'words', words,
   'current', idx % jsonb_array_length(g->'players'),
   'selected', null,
   'last', null,
   'category', q->>'category',
   'result', null,
   'answer', null,
   'round_points', 0
 );
end $$;

create or replace function public.public_room_snapshot(room uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare r public.rooms; members jsonb; history jsonb; safe_game jsonb;
begin
 if not private.member(room) then raise exception 'Acesso negado.'; end if;
 select * into r from public.rooms where id=room;
 select coalesce(jsonb_agg(jsonb_build_object(
   'user_id', user_id,
   'nickname', nickname,
   'spectator', spectator,
   'display_only', display_only,
   'last_seen', last_seen
 ) order by joined_at, user_id), '[]')
 into members from public.room_members where room_id=room;

 select coalesce(jsonb_agg(jsonb_build_object(
   'id', h.id,
   'ended_at', h.ended_at,
   'scores', h.scores,
   'total_rounds', coalesce(h.total_rounds, 1),
   'host_id', h.host_id,
   'host_nickname', coalesce(h.host_nickname, 'Organizador'),
   'winner_id', coalesce(h.winner_id, (
     select (p->>'id')::uuid
     from jsonb_array_elements(h.scores) p
     order by (p->>'score')::int desc
     limit 1
   )),
   'winner_nickname', coalesce(h.winner_nickname, (
     select p->>'nickname'
     from jsonb_array_elements(h.scores) p
     order by (p->>'score')::int desc
     limit 1
   ))
 )), '[]')
 into history
 from (
   select * from public.room_match_history
   where room_id=room
   order by ended_at desc
   limit 10
 ) h;

 safe_game := r.game;
 if safe_game is not null and coalesce(safe_game->>'phase', '') <> 'result' then
   safe_game := safe_game - 'answer';
 end if;

 return jsonb_build_object(
   'id', r.id,
   'code', r.code,
   'host_id', r.host_id,
   'roulette', r.roulette,
   'members', members,
   'game', safe_game,
   'history', history
 );
end $$;

create or replace function public.choose_host(room uuid, member uuid default null)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare r public.rooms; h uuid; nick text; spin_nonce text;
begin
 perform private.throttle('host', 20);
 select * into r from public.rooms where id=room for update;
 if r.host_id <> auth.uid() or not private.member(room) or r.game->>'status' = 'active' then
   raise exception 'Organizador só pode mudar entre partidas.';
 end if;
 select user_id, nickname into h, nick
 from public.room_members
 where room_id=room and not spectator and not display_only and (member is null or user_id=member)
 order by case when member is null and user_id <> r.host_id then 0 else 1 end, random()
 limit 1;
 if h is null then raise exception 'Escolha um participante.'; end if;
 spin_nonce := gen_random_uuid()::text;
 if member is null then
   update public.rooms
   set host_id = h,
       roulette = jsonb_build_object(
         'id', spin_nonce,
         'winner_id', h,
         'winner_nickname', nick,
         'mode', 'roulette',
         'spun_at', now()
       )
   where id=room;
 else
   update public.rooms
   set host_id = h,
       roulette = jsonb_build_object(
         'id', spin_nonce,
         'winner_id', h,
         'winner_nickname', nick,
         'mode', 'manual',
         'spun_at', now()
       )
   where id=room;
 end if;
 perform private.notify_room(room);
end $$;

create or replace function public.question_catalog(room uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
 if not exists(select 1 from public.rooms where id=room and host_id=auth.uid()) then
   raise exception 'Somente organizador.';
 end if;
 if exists(select 1 from public.rooms where id=room and game->>'status'='active') then
   raise exception 'Catálogo fechado durante a partida.';
 end if;
 return (
   select coalesce(
     jsonb_agg(
       jsonb_build_object(
         'id', id,
         'category', category,
         'question', question,
         'word_count', cardinality(private.tokens(question)),
         'own', owner_id is not null
       )
       order by owner_id is null, category, id
     ),
     '[]'
   )
   from private.questions
   where (owner_id is null or owner_id=auth.uid())
     and (
       review_status='approved'
       or (select allow_provisional from private.settings where singleton)
       or owner_id=auth.uid()
     )
 );
end $$;

create or replace function public.host_question_preview(room uuid, question_id text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare q jsonb;
begin
 perform private.throttle('preview', 60);
 if not exists(select 1 from public.rooms where id=room and host_id=auth.uid()) then
   raise exception 'Somente organizador.';
 end if;
 if exists(select 1 from public.rooms where id=room and game->>'status'='active') then
   raise exception 'Catálogo fechado durante a partida.';
 end if;
 select jsonb_build_object(
   'id', id,
   'question', question,
   'answer', answer,
   'aliases', aliases,
   'category', category,
   'word_count', cardinality(private.tokens(question)),
   'own', owner_id is not null
 ) into q
 from private.questions
 where id = question_id
   and (owner_id is null or owner_id=auth.uid())
   and (
     review_status='approved'
     or (select allow_provisional from private.settings where singleton)
     or owner_id=auth.uid()
   );
 if q is null then raise exception 'Pergunta não encontrada ou indisponível.'; end if;
 return q;
end $$;

create or replace function public.prepare_match(
  room uuid,
  planned integer,
  categories text[],
  exact_words integer default null,
  selected text[] default '{}',
  selection_mode text default 'automatic'
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare r public.rooms; deck jsonb; players jsonb; mid uuid:=gen_random_uuid();
begin
 perform private.throttle('prepare', 10);
 select * into r from public.rooms where id=room for update;
 if not private.member(room) or r.host_id<>auth.uid() or r.game->>'status'='active' then
   raise exception 'Preparação indisponível.';
 end if;
 if planned is null or planned not between 1 and 30 or (exact_words is not null and exact_words not between 1 and 22) or selection_mode is null or selection_mode not in ('automatic','manual','mixed') then
   raise exception 'Configuração inválida.';
 end if;
 if cardinality(selected) <> (select count(distinct x) from unnest(selected) x) then
   raise exception 'Não repita perguntas.';
 end if;
 select jsonb_agg(jsonb_build_object('id', user_id, 'nickname', nickname, 'score', 0) order by joined_at, user_id)
 into players
 from public.room_members
 where room_id=room and user_id<>r.host_id and not spectator and not display_only;
 if players is null then
   raise exception 'Convide pelo menos um jogador.';
 end if;
 with candidates as (
   select *, array_position(selected, id) priority
   from private.questions
   where (owner_id is null or owner_id=auth.uid())
     and (
       review_status='approved'
       or (select allow_provisional from private.settings where singleton)
       or owner_id=auth.uid()
     )
     and category=any(categories)
     and (exact_words is null or cardinality(private.tokens(question))=exact_words)
     and cardinality(private.tokens(question)) between 1 and 22
     and (selection_mode<>'manual' or id=any(selected))
 ), ordered as (
   select * from candidates order by priority nulls last, random() limit planned+5
 )
 select jsonb_agg(jsonb_build_object('id', id, 'question', question, 'answer', answer, 'aliases', aliases, 'category', category))
 into deck from ordered;

 if coalesce(jsonb_array_length(deck), 0) < planned then
   raise exception 'Perguntas insuficientes para esses filtros. Reduza rodadas ou amplie categorias.';
 end if;
 if selection_mode<>'automatic' and (select count(*) from jsonb_array_elements(deck) q where q->>'id'=any(selected)) <> cardinality(selected) then
   raise exception 'Seleção incompatível com filtros ou limite.';
 end if;

 insert into private.decks(match_id, room_id, questions, filters)
 values(mid, room, deck, jsonb_build_object('categories', to_jsonb(categories), 'exact_words', exact_words));

 update public.rooms
 set game = private.round_state(
   jsonb_build_object(
     'id', mid,
     'host', r.host_id,
     'status', 'active',
     'version', 1,
     'paused', false,
     'planned', planned,
     'prepared', jsonb_array_length(deck),
     'players', players,
     'winner', null
   ),
   deck->0,
   0
 )
 where id=room;
 perform private.notify_room(room);
end $$;

create or replace function public.game_command(
  room uuid,
  match uuid,
  expected_version integer,
  idempotency_key uuid,
  command text,
  payload jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.rooms;
  g jsonb;
  d private.decks;
  a private.actions;
  q jsonb;
  idx integer;
  n integer;
  cnt integer;
  cur integer;
  ps jsonb;
  p jsonb;
  v integer;
  top_score integer;
  leaders integer;
  win text;
  win_nick text;
  host_nick text;
  guess_text text;
  suggestion boolean;
  target uuid;
  pts integer;
begin
 perform private.throttle('command', 180);
 if payload is null or jsonb_typeof(payload)<>'object' or length(payload::text)>4000 then
   raise exception 'Comando inválido ou muito extenso.';
 end if;
 select * into r from public.rooms where id=room for update;
 if not private.member(room) or r.host_id<>auth.uid() then
   raise exception 'Somente organizador.';
 end if;
 g := r.game;
 if g is null or g->>'id' <> match::text then
   raise exception 'Partida incorreta.';
 end if;
 select * into a from private.actions where match_id=match and key=idempotency_key;
 if found then
   if a.actor<>auth.uid() or a.command<>game_command.command or a.payload<>game_command.payload then
     raise exception 'Chave reutilizada com outro comando.';
   end if;
   return;
 end if;
 v := (g->>'version')::int;
 if expected_version is null or v<>expected_version then
   raise exception 'Conflito de versão. Estado atualizado; tente novamente.';
 end if;
 if g->>'status'<>'active' then
   raise exception 'Partida encerrada.';
 end if;
 if (g->>'paused')::boolean and command not in ('resume','cancel') then
   raise exception 'Partida pausada.';
 end if;
 if command not in ('pause','resume','cancel') and exists(
   select 1 from public.room_members
   where room_id=room and user_id=r.host_id and last_seen < now()-interval '45 seconds'
 ) then
   raise exception 'Reconecte e retome a partida.';
 end if;

 select * into d from private.decks where match_id=match;
 q := d.questions->((g->>'round')::int);
 n := jsonb_array_length(g->'words');
 cur := (g->>'current')::int;
 select count(*) into cnt from jsonb_array_elements(g->'words') w where w<>'null'::jsonb;

 if command='pause' then
   g := g||'{"paused":true}';
 elsif command='resume' then
   g := g||'{"paused":false}';
 elsif command='cancel' then
   g := g||'{"status":"cancelled"}';
   update public.room_members set spectator=display_only where room_id=room;
 elsif command='select' then
   idx := (payload->>'position')::int;
   if g->>'phase'<>'awaiting_position' or idx is null or idx<0 or idx>=n or g->'words'->idx<>'null'::jsonb then
     raise exception 'Posição indisponível.';
   end if;
   g := g||jsonb_build_object('selected', idx, 'phase', 'pending_confirmation');
 elsif command='cancel_selection' then
   if g->>'phase'<>'pending_confirmation' then
     raise exception 'Não há seleção.';
   end if;
   g := g||'{"selected":null,"phase":"awaiting_position"}';
 elsif command='reveal' then
   if g->>'phase'<>'pending_confirmation' then
     raise exception 'Selecione e confirme uma posição.';
   end if;
   idx := (g->>'selected')::int;
   g := jsonb_set(g, array['words', idx::text], to_jsonb((private.tokens(q->>'question'))[idx+1]))
        || jsonb_build_object('phase', 'awaiting_guess', 'last', idx, 'selected', null);
   update private.decks set guess=null where match_id=match;
 elsif command='undo' then
   if g->>'phase'<>'awaiting_guess' or g->>'last' is null or d.guess is not null then
     raise exception 'Desfazer indisponível após registrar palpite.';
   end if;
   idx := (g->>'last')::int;
   g := jsonb_set(g, array['words', idx::text], 'null')
        || '{"phase":"awaiting_position","last":null}';
 elsif command='guess' then
   if g->>'phase'<>'awaiting_guess' or coalesce(length(trim(payload->>'text')), 0) not between 1 and 200 then
     raise exception 'Registre o palpite da vez.';
   end if;
   guess_text := trim(payload->>'text');
   suggestion := private.norm(guess_text)=private.norm(q->>'answer')
     or exists(select 1 from jsonb_array_elements_text(q->'aliases') x where private.norm(x)=private.norm(guess_text));
   update private.decks
   set guess = jsonb_build_object('text', guess_text, 'suggested', suggestion, 'player', g->'players'->cur->>'id')
   where match_id=match;
 elsif command in ('judge','pass','skip') then
   if command='skip' then
     target := (g->'players'->cur->>'id')::uuid;
     if g->>'phase'<>'awaiting_position' or exists(
       select 1 from public.room_members
       where room_id=room and user_id=target and last_seen >= now()-interval '45 seconds'
     ) then
       raise exception 'Jogador ainda conectado ou jogada em curso.';
     end if;
   elsif g->>'phase'<>'awaiting_guess' then
     raise exception 'Aguarde a revelação.';
   end if;
   if command='judge' and (d.guess is null or jsonb_typeof(payload->'correct') is distinct from 'boolean') then
     raise exception 'Registre palpite e decisão humana.';
   end if;
   if command='judge' and (payload->>'correct')::boolean then
     pts := n - cnt + 1;
     ps := g->'players';
     p := ps->cur;
     p := p||jsonb_build_object('score', (p->>'score')::int + pts);
     g := jsonb_set(g, array['players', cur::text], p)
          || jsonb_build_object('phase', 'result', 'result', p->>'id', 'round_points', pts, 'answer', q->>'answer');
   elsif cnt=n then
     g := g||jsonb_build_object('phase', 'result', 'result', null, 'round_points', 0, 'answer', q->>'answer');
   else
     g := g||jsonb_build_object('phase', 'awaiting_position', 'current', (cur+1)%jsonb_array_length(g->'players'), 'last', null);
   end if;
   if g->>'phase'='result' then
     g := g||jsonb_build_object('words', to_jsonb(private.tokens(q->>'question')));
   end if;
 elsif command='adjust' then
   idx := (payload->>'rounds')::int;
   if idx is null or idx < (g->>'round')::int + 1 or idx > jsonb_array_length(d.questions) then
     raise exception 'Use apenas rodadas previamente preparadas.';
   end if;
   g := g||jsonb_build_object('planned', idx);
 elsif command='reserve_custom' then
   if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
     raise exception 'Conta permanente obrigatória.';
   end if;
   if g->>'phase'<>'result' or (g->>'round')::int + 1 < jsonb_array_length(d.questions) then
     raise exception 'Prepare a pergunta extra somente após esgotar a reserva.';
   end if;
   if coalesce(cardinality(private.tokens(payload->>'question')), 0) not between 1 and 22 or coalesce(length(trim(payload->>'answer')), 0) not between 1 and 200 then
     raise exception 'Use de 1 a 22 palavras e uma resposta.';
   end if;
   if exists(
     select 1 from jsonb_array_elements(d.questions) z
     where private.norm(z->>'question') = private.norm(array_to_string(private.tokens(payload->>'question'), ' '))
   ) then
     raise exception 'Pergunta já usada nesta partida.';
   end if;
   q := jsonb_build_object(
     'id', gen_random_uuid()::text,
     'question', array_to_string(private.tokens(payload->>'question'), ' '),
     'answer', trim(payload->>'answer'),
     'aliases', '[]'::jsonb,
     'category', 'Pergunta própria'
   );
   insert into private.questions(id, owner_id, question, answer, category, aliases, review_status)
   values(q->>'id', auth.uid(), q->>'question', q->>'answer', q->>'category', '[]', 'approved');
   update private.decks set questions = questions || jsonb_build_array(q) where match_id=match;
   g := g||jsonb_build_object('prepared', jsonb_array_length(d.questions)+1);
 elsif command='reserve' then
   if g->>'phase'<>'result' or (g->>'round')::int + 1 < jsonb_array_length(d.questions) then
     raise exception 'Reserva ainda disponível ou rodada em curso.';
   end if;
   -- Prioriza filtros da partida (categoria e tamanho exato), com fallback para qualquer pergunta elegível se o recorte específico se esgotar
   select jsonb_build_object('id', id, 'question', question, 'answer', answer, 'aliases', aliases, 'category', category)
   into q
   from private.questions
   where (owner_id is null or owner_id=auth.uid())
     and (
       review_status='approved'
       or (select allow_provisional from private.settings where singleton)
       or owner_id=auth.uid()
     )
     and not exists(select 1 from jsonb_array_elements(d.questions) z where z->>'id'=questions.id)
   order by
     case
       when (
         jsonb_typeof(d.filters->'categories') = 'array'
         and category in (select jsonb_array_elements_text(d.filters->'categories'))
         and (d.filters->>'exact_words' is null or cardinality(private.tokens(question)) = (d.filters->>'exact_words')::int)
       ) then 0
       when (
         jsonb_typeof(d.filters->'categories') = 'array'
         and category in (select jsonb_array_elements_text(d.filters->'categories'))
       ) then 1
       else 2
     end,
     random()
   limit 1;
   if q is null then
     raise exception 'Catálogo esgotado. Cancele e amplie o catálogo antes de outra partida.';
   end if;
   update private.decks set questions = questions || jsonb_build_array(q) where match_id=match;
   g := g||jsonb_build_object('prepared', jsonb_array_length(d.questions)+1);
 elsif command='next' then
   if g->>'phase'<>'result' then
     raise exception 'Conclua a rodada antes de avançar.';
   end if;
   select max((x->>'score')::int) into top_score from jsonb_array_elements(g->'players') x;
   select count(*), min(x->>'id') into leaders, win from jsonb_array_elements(g->'players') x where (x->>'score')::int=top_score;
   idx := (g->>'round')::int + 1;
   if idx >= (g->>'planned')::int and leaders=1 then
     select x->>'nickname' into win_nick from jsonb_array_elements(g->'players') x where x->>'id'=win limit 1;
     select nickname into host_nick from public.room_members where room_id=room and user_id=r.host_id limit 1;
     g := g||jsonb_build_object('status', 'completed', 'winner', win);
     insert into public.room_match_history(id, room_id, scores, winner_id, winner_nickname, host_id, host_nickname, total_rounds)
     values(match, room, g->'players', win::uuid, win_nick, r.host_id, coalesce(host_nick, 'Organizador'), idx);
     update public.room_members set spectator=display_only where room_id=room;
   else
     if idx >= jsonb_array_length(d.questions) then
       raise exception 'Empate sem reserva. Prepare uma pergunta extra.';
     end if;
     g := private.round_state(g, d.questions->idx, idx);
     update private.decks set guess=null where match_id=match;
   end if;
 else
   raise exception 'Comando desconhecido.';
 end if;

 g := g||jsonb_build_object('version', v+1);
 update public.rooms set game=g where id=room;
 insert into private.actions values(match, idempotency_key, auth.uid(), command, payload, v+1, now());
 perform private.notify_room(room);
end $$;

revoke execute on function public.host_question_preview(uuid, text) from public, anon;
grant execute on function public.host_question_preview(uuid, text) to authenticated;
