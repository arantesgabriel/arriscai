-- Quotas por maiores restos; empates favorecem fácil e depois média.
create function private.difficulty_quotas(total integer) returns jsonb
language sql immutable set search_path='' as $$
 with weights(level,weight,priority) as (values ('facil',50,1),('medio',35,2),('dificil',15,3)),
 base as (select *, total*weight/100 n, total*weight%100 remainder from weights),
 ranked as (select *, row_number() over(order by remainder desc,priority) rank from base)
 select jsonb_object_agg(level,n + case when rank<=total-(select sum(n) from base) then 1 else 0 end) from ranked;
$$;

create function private.balanced_question_deck(pool jsonb, planned integer, selected text[], mode text)
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
     select coalesce(jsonb_agg(value),'[]') into remaining from jsonb_array_elements(remaining) where value->>'id'<>item->>'id';
   end loop;
   select result||coalesce(jsonb_agg(value order by random()),'[]') into result from jsonb_array_elements(batch);
 end loop;
 return result;
end $$;
revoke all on function private.difficulty_quotas(integer), private.balanced_question_deck(jsonb,integer,text[],text) from public, anon, authenticated;

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
 ), pool as (
   select jsonb_agg(jsonb_build_object('id',id,'question',question,'answer',answer,'aliases',aliases,'category',category,'difficulty',difficulty)) items from candidates
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
   where (owner_id is null or owner_id=auth.uid())
     and (
       review_status='approved'
       or (select allow_provisional from private.settings where singleton)
       or owner_id=auth.uid()
     )
 );
end $$;