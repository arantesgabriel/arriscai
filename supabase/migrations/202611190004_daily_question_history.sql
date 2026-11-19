alter table private.questions add column topic_key text;
create table private.question_exposures (
 user_id uuid not null references auth.users(id) on delete cascade,
 question_id text not null,
 play_day date not null default (now() at time zone 'America/Sao_Paulo')::date,
 question text not null, answer text not null, topic_key text,
 primary key(user_id,question_id,play_day)
);
revoke all on private.question_exposures from public,anon,authenticated;
alter table private.question_exposures enable row level security;
create index question_exposures_daily on private.question_exposures(user_id,play_day);

-- Recover today's completed matches without exposing any catalogue content.
insert into private.question_exposures(user_id,question_id,play_day,question,answer,topic_key)
select distinct participant.uid,(q.value->>'id'),(h.ended_at at time zone 'America/Sao_Paulo')::date,
q.value->>'question',q.value->>'answer',p.topic_key
from public.room_match_history h join private.decks d on d.match_id=h.id
cross join lateral jsonb_array_elements(d.questions) with ordinality q(value,position)
cross join lateral (
 select (value->>'id')::uuid uid from jsonb_array_elements(h.scores)
 union select h.host_id where h.host_id is not null
) participant
left join private.questions p on p.id=q.value->>'id'
where (h.ended_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date
and q.position<=h.total_rounds and q.value->>'id' is not null
on conflict do nothing;

-- Include the questions already reached by matches that are still running.
insert into private.question_exposures(user_id,question_id,question,answer,topic_key)
select distinct m.user_id,q.value->>'id',q.value->>'question',q.value->>'answer',p.topic_key
from public.rooms r join private.decks d on d.match_id=(r.game->>'id')::uuid
join public.room_members m on m.room_id=r.id and not m.display_only
cross join lateral jsonb_array_elements(d.questions) with ordinality q(value,position)
left join private.questions p on p.id=q.value->>'id'
where r.game->>'status'='active' and q.position<=(r.game->>'round')::int+1 and q.value->>'id' is not null
on conflict do nothing;

create function private.similar_question(a text,b text) returns boolean
language sql immutable set search_path='' as $$
 with x as (select distinct w from unnest(string_to_array(private.norm(a),' ')) w where length(w)>=4),
 y as (select distinct w from unnest(string_to_array(private.norm(b),' ')) w where length(w)>=4),
 counts as (select (select count(*) from x join y using(w))::numeric common,
 (select count(*) from (select w from x union select w from y) u) total)
 select private.norm(a)=private.norm(b) or (common>=3 and common/nullif(total,0)>=0.65) from counts
$$;

create function private.seen_question_today(room uuid,qid text,qtext text,qanswer text,qtopic text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
 select 1 from private.question_exposures e join public.room_members m on m.user_id=e.user_id
 where m.room_id=room and not m.display_only
 and e.play_day=(now() at time zone 'America/Sao_Paulo')::date
 and (e.question_id=qid or private.norm(e.answer)=private.norm(qanswer)
 or (qtopic is not null and e.topic_key=qtopic) or private.similar_question(e.question,qtext)))
$$;

create function private.record_question_exposure() returns trigger
language plpgsql security definer set search_path='' as $$
declare q jsonb;
begin
 if new.game->>'status'='active' and
 (old.game->>'id' is distinct from new.game->>'id' or old.game->>'round' is distinct from new.game->>'round') then
   select questions->((new.game->>'round')::int) into q from private.decks where match_id=(new.game->>'id')::uuid;
   insert into private.question_exposures(user_id,question_id,question,answer,topic_key)
   select m.user_id,q->>'id',q->>'question',q->>'answer',p.topic_key
   from public.room_members m left join private.questions p on p.id=q->>'id'
   where m.room_id=new.id and not m.display_only and q->>'id' is not null
   on conflict do nothing;
 end if;
 return new;
end $$;
create trigger record_question_exposure after update of game on public.rooms
for each row execute function private.record_question_exposure();

create function private.record_join_exposure() returns trigger
language plpgsql security definer set search_path='' as $$
declare q jsonb;
begin
 if new.display_only then return new; end if;
 select d.questions->((r.game->>'round')::int) into q
 from public.rooms r join private.decks d on d.match_id=(r.game->>'id')::uuid
 where r.id=new.room_id and r.game->>'status'='active';
 if q->>'id' is not null then
   insert into private.question_exposures(user_id,question_id,question,answer,topic_key)
   values(new.user_id,q->>'id',q->>'question',q->>'answer',(select topic_key from private.questions where id=q->>'id'))
   on conflict do nothing;
 end if;
 return new;
end $$;
create trigger record_join_exposure after insert on public.room_members
for each row execute function private.record_join_exposure();
revoke all on function private.record_join_exposure() from public,anon,authenticated;
revoke all on function private.similar_question(text,text),private.seen_question_today(uuid,text,text,text,text),private.record_question_exposure() from public,anon,authenticated;
create or replace function private.prepare_match_before_lobby_rules(
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
declare r public.rooms; deck jsonb; players jsonb; mid uuid:=gen_random_uuid(); participant uuid;
begin
 perform private.throttle('prepare', 10);
 select * into r from public.rooms where id=room for update;
 if not private.member(room) or r.host_id<>auth.uid() or r.game->>'status' in ('active','completed') then
   raise exception 'Preparação indisponível.';
 end if;
 if r.roulette->>'mode'='roulette' and now() < (r.roulette->>'spun_at')::timestamptz + interval '5.1 seconds' then
   raise exception 'Aguarde o sorteio terminar.';
 end if;
 if (select count(*) from public.room_members where room_id=room and not display_only)>14 then
   raise exception 'A partida comporta no máximo 14 participantes, incluindo o organizador.';
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
 -- Lock participant histories in a stable order across rooms.
 for participant in select user_id from public.room_members where room_id=room and not display_only order by user_id loop
   perform pg_advisory_xact_lock(hashtextextended(participant::text, 19));
 end loop;
 with candidates as (
   select *, array_position(selected, id) priority
   from private.questions
   where (owner_id is null or owner_id=auth.uid())
     and (
       review_status='approved'
       or (select allow_provisional from private.settings where singleton)
       or owner_id=auth.uid()
     )
     and not private.seen_question_today(room,id,question,answer,topic_key)
     and category=any(categories)
     and (exact_words is null or cardinality(private.tokens(question))=exact_words)
     and cardinality(private.tokens(question)) between 1 and 22
     and (selection_mode<>'manual' or id=any(selected))
 ), pool as (
   select jsonb_agg(jsonb_build_object('id',id,'question',question,'answer',answer,'aliases',aliases,'category',category,'difficulty',difficulty,'topic_key',topic_key)) items from candidates
 ), balanced as (
   select private.balanced_question_deck(coalesce(items,'[]'), planned, selected, selection_mode) items from pool
 ), ordered as (
   select value, ordinality from balanced, jsonb_array_elements(items) with ordinality
 )
 select jsonb_agg(value order by ordinality) into deck from ordered;

 if coalesce(jsonb_array_length(deck), 0) < planned then
   if not exists (
     select 1 from private.questions q
     where (q.owner_id is null or q.owner_id=auth.uid())
       and (q.review_status='approved'
         or (select allow_provisional from private.settings where singleton)
         or q.owner_id=auth.uid())
       and cardinality(private.tokens(q.question)) between 1 and 22
   ) then
     raise exception 'Nenhuma pergunta elegível disponível. Aguarde a liberação editorial do catálogo ou use perguntas próprias com uma conta permanente.';
   end if;
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


create or replace function private.game_command(
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
 if not private.member(room) or (r.host_id<>auth.uid() and command<>'submit_guess') then
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
 if command='submit_guess' and (
   g->'players'->((g->>'current')::int)->>'id' is distinct from auth.uid()::text
   or not exists(select 1 from public.room_members m where m.room_id=room and m.user_id=auth.uid() and not m.display_only and not m.spectator)
 ) then
   raise exception 'Somente o jogador da vez pode enviar o palpite.';
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

 -- Persist expiry instead of accepting a late guess or rolling back the turn change.
 if private.expire_guess(room) then return; end if;

 if command='pause' then
   g := g||'{"paused":true}';
 elsif command='resume' then
   g := g||'{"paused":false}';
 elsif command='cancel' then
   g := g||'{"status":"cancelled"}';
   update public.room_members set spectator=display_only where room_id=room;
 elsif command='skip_question' then
   if g->>'phase'='result' then
     raise exception 'Rodada já encerrada.';
   end if;
   g := (g - 'live_guess' - 'feedback' - 'timed_out') || jsonb_build_object(
     'phase','result','result',null,'round_points',0,'answer',q->>'answer',
     'words',to_jsonb(private.tokens(q->>'question')),'selected',null,'last',null);
   update private.decks set guess=null where match_id=match;
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
        || jsonb_build_object('phase', 'awaiting_guess', 'last', idx, 'selected', null, 'live_guess', null);
   update private.decks set guess=null where match_id=match;
 elsif command='undo' then
   if g->>'phase'<>'awaiting_guess' or g->>'last' is null or d.guess is not null then
     raise exception 'Desfazer indisponível após registrar palpite.';
   end if;
   idx := (g->>'last')::int;
   g := jsonb_set(g, array['words', idx::text], 'null')
        || '{"phase":"awaiting_position","last":null}';
 elsif command in ('guess','submit_guess') then
   if command='submit_guess' and jsonb_typeof(payload->'text') is distinct from 'string' then
     raise exception 'Registre o palpite da vez.';
   end if;
   if command='submit_guess' and d.guess is not null then
     raise exception 'Palpite já enviado. Aguarde a avaliação do organizador.';
   end if;
   if g->>'phase'<>'awaiting_guess' or coalesce(length(trim(payload->>'text')), 0) not between 1 and 200 then
     raise exception 'Registre o palpite da vez.';
   end if;
   guess_text := trim(payload->>'text');
   suggestion := private.norm(guess_text)=private.norm(q->>'answer')
     or exists(select 1 from jsonb_array_elements_text(q->'aliases') x where private.norm(x)=private.norm(guess_text));
   update private.decks
   set guess = jsonb_build_object('text', guess_text, 'suggested', suggestion, 'player', g->'players'->cur->>'id')
   where match_id=match;
   g := g||jsonb_build_object('live_guess',jsonb_build_object(
     'id',idempotency_key,'player_id',g->'players'->cur->>'id',
     'nickname',g->'players'->cur->>'nickname','text',guess_text,'at',now()));
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
   if command='judge' and not (payload->>'correct')::boolean then
     g := g||jsonb_build_object('feedback',jsonb_build_object(
       'id',idempotency_key,'kind','incorrect','player_id',g->'players'->cur->>'id',
       'nickname',g->'players'->cur->>'nickname','at',now()));
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
   where not private.seen_question_today(room,id,question,answer,topic_key)
     and (owner_id is null or owner_id=auth.uid())
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
     q := d.questions->idx;
     if private.seen_question_today(room,q->>'id',q->>'question',q->>'answer',
       (select topic_key from private.questions where id=q->>'id')) then
       select jsonb_build_object('id',id,'question',question,'answer',answer,'aliases',aliases,'category',category,'difficulty',difficulty)
       into q from private.questions
       where (owner_id is null or owner_id=auth.uid())
       and (review_status='approved' or (select allow_provisional from private.settings where singleton) or owner_id=auth.uid())
       and category in (select jsonb_array_elements_text(d.filters->'categories'))
       and (d.filters->>'exact_words' is null or cardinality(private.tokens(question))=(d.filters->>'exact_words')::int)
       and cardinality(private.tokens(question)) between 1 and 22
       and not private.seen_question_today(room,id,question,answer,topic_key)
       order by random() limit 1;
       if q is null then raise exception 'Não há perguntas inéditas para estes participantes hoje. Amplie os filtros na próxima partida.'; end if;
       update private.decks set questions=jsonb_set(questions,array[idx::text],q) where match_id=match;
     end if;
     g := private.round_state(g - 'live_guess' - 'feedback', q, idx);
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
         'difficulty', difficulty,
         'question', question,
         'word_count', cardinality(private.tokens(question)),
         'own', owner_id is not null
       )
       order by owner_id is null, category, id
     ),
     '[]'
   )
   from private.questions
   where not private.seen_question_today(room,id,question,answer,topic_key)
     and (owner_id is null or owner_id=auth.uid())
     and (
       review_status='approved'
       or (select allow_provisional from private.settings where singleton)
       or owner_id=auth.uid()
     )
 );
end $$;


create or replace function private.balanced_question_deck(pool jsonb, planned integer, selected text[], mode text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb:='[]'; batch jsonb; remaining jsonb:=pool; quotas jsonb; item jsonb; wanted text;
        size integer; stage integer; level text; chosen integer; deficit integer; best integer;
begin
 if mode='manual' then
   return (select coalesce(jsonb_agg(q order by array_position(selected,q->>'id')),'[]')
     from (select value q from jsonb_array_elements(pool) where value->>'id'=any(selected)
       order by array_position(selected,value->>'id') limit planned+5) s);
 end if;
 -- A reserva não deve diluir a distribuição das rodadas efetivamente jogadas.
 for stage in 1..2 loop
   size:=case when stage=1 then planned else 5 end;
   quotas:=private.difficulty_quotas(size); batch:='[]';
   if mode='mixed' then
     select coalesce(jsonb_agg(q order by array_position(selected,q->>'id')),'[]') into batch
     from (select value q from jsonb_array_elements(remaining)
       where value->>'id'=any(selected) order by array_position(selected,value->>'id') limit size) s;
     select coalesce(jsonb_agg(r.value),'[]') into remaining from jsonb_array_elements(remaining) r
       where not exists(select 1 from jsonb_array_elements(batch) b where b.value->>'id'=r.value->>'id');
   end if;
   while jsonb_array_length(batch)<size and jsonb_array_length(remaining)>0 loop
     wanted:=null; best:=0;
     foreach level in array array['facil','medio','dificil'] loop
       select count(*) into chosen from jsonb_array_elements(batch) q where q->>'difficulty'=level;
       deficit:=(quotas->>level)::int-chosen;
       if deficit>best and exists(select 1 from jsonb_array_elements(remaining) q where q->>'difficulty'=level) then
         best:=deficit; wanted:=level;
       end if;
     end loop;
     select value into item from jsonb_array_elements(remaining)
       where wanted is null or value->>'difficulty'=wanted
       order by case when wanted is null then case value->>'difficulty' when 'facil' then 1 when 'medio' then 2 else 3 end else 0 end, random() limit 1;
     batch:=batch||jsonb_build_array(item);
     select coalesce(jsonb_agg(value),'[]') into remaining from jsonb_array_elements(remaining) where value->>'id'<>item->>'id'
       and private.norm(value->>'answer')<>private.norm(item->>'answer')
       and not private.similar_question(value->>'question',item->>'question')
       and (value->>'topic_key' is null or item->>'topic_key' is null or value->>'topic_key'<>item->>'topic_key');
   end loop;
   select result||coalesce(jsonb_agg(value order by random()),'[]') into result from jsonb_array_elements(batch);
 end loop;
 return result;
end $$;


