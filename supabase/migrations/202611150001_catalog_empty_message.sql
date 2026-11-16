-- Orientação específica quando o estoque elegível global está vazio.
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
