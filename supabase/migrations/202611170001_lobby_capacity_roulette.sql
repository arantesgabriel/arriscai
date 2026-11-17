-- Fourteen participant seats; displays do not occupy a player seat.
-- Freeze the draw roster and serialize new draws until countdown + spin finish.
create or replace function public.join_room(code text,nickname text,screen boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.rooms;
begin
 perform private.throttle('join',20);
 select * into r from public.rooms where rooms.code=upper(trim(join_room.code)) for update;
 if r.id is null then raise exception 'Sala não encontrada.'; end if;
 if not screen and not private.member(r.id) and (select count(*) from public.room_members where room_id=r.id and not display_only)>=14 then raise exception 'Sala cheia: o limite é de 14 participantes.'; end if;
 if (select count(*) from public.room_members where room_id=r.id)>=50 and not private.member(r.id) then raise exception 'Sala cheia.'; end if;
 insert into public.room_members(room_id,user_id,nickname,spectator,display_only) values(r.id,auth.uid(),trim(nickname),screen or coalesce(r.game->>'status'='active',false),screen)
 on conflict(room_id,user_id) do update set last_seen=now();
 perform private.notify_room(r.id); return r.id;
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
 if r.roulette->>'mode'='roulette' and now() < (r.roulette->>'spun_at')::timestamptz + interval '5.1 seconds' then
   raise exception 'Aguarde o sorteio terminar.';
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
         'spun_at', now(),
         'previous_host_id', r.host_id,
         'members', (select jsonb_agg(jsonb_build_object('user_id', user_id, 'nickname', nickname, 'spectator', spectator, 'display_only', display_only, 'last_seen', last_seen) order by joined_at, user_id) from public.room_members where room_id=room and not spectator and not display_only)
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
         'spun_at', now(),
         'previous_host_id', r.host_id,
         'members', (select jsonb_agg(jsonb_build_object('user_id', user_id, 'nickname', nickname, 'spectator', spectator, 'display_only', display_only, 'last_seen', last_seen) order by joined_at, user_id) from public.room_members where room_id=room and not spectator and not display_only)
       )
   where id=room;
 end if;
 perform private.notify_room(room);
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
