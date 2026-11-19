-- Normalize once when content changes, not for every candidate/history pair.
create function private.question_terms(t text) returns text[]
language sql immutable set search_path='' as $$
 select coalesce(array_agg(w order by w),'{}'::text[]) from (
 select distinct w from unnest(string_to_array(private.norm(t),' ')) w where length(w)>=4
 ) words
$$;

create function private.similar_word_sets(a text[],b text[]) returns boolean
language plpgsql immutable set search_path='' as $$
declare common integer; na integer:=cardinality(a); nb integer:=cardinality(b);
begin
 if coalesce(least(na,nb),0)<3 then return false; end if;
 if least(na,nb)::numeric/greatest(na,nb)<0.65 then return false; end if;
 select count(*) into common from unnest(a) w where w=any(b);
 return common>=3 and common::numeric/(na+nb-common)>=0.65;
end $$;

create or replace function private.similar_question(a text,b text) returns boolean
language sql immutable set search_path='' as $$
 select private.norm(a)=private.norm(b) or private.similar_word_sets(private.question_terms(a),private.question_terms(b))
$$;

alter table private.questions
 add column question_key text generated always as (private.norm(question)) stored,
 add column answer_key text generated always as (private.norm(answer)) stored,
 add column question_words text[] generated always as (private.question_terms(question)) stored;
alter table private.question_exposures
 add column question_key text generated always as (private.norm(question)) stored,
 add column answer_key text generated always as (private.norm(answer)) stored,
 add column question_words text[] generated always as (private.question_terms(question)) stored;
create index questions_question_key on private.questions(question_key);
create index questions_answer_key on private.questions(answer_key);
create index questions_topic_key on private.questions(topic_key) where topic_key is not null;
create index questions_words on private.questions using gin(question_words);

-- A question seen by five participants is compared once, not five times.
-- Callers use an uncorrelated subquery so this set is built once per command.
create function private.room_seen_question_ids(room uuid) returns table(id text)
language sql stable security definer set search_path='' as $$
 with seen as materialized (
 select distinct e.question_id,e.question_key,e.answer_key,e.question_words,e.topic_key
 from private.question_exposures e
 where e.play_day=(now() at time zone 'America/Sao_Paulo')::date
 and e.user_id in (select m.user_id from public.room_members m where m.room_id=room and not m.display_only)
 )
 select q.id from seen e join private.questions q on q.id=e.question_id
 union select q.id from seen e join private.questions q on q.answer_key=e.answer_key
 union select q.id from seen e join private.questions q on q.question_key=e.question_key
 union select q.id from seen e join private.questions q on q.topic_key=e.topic_key
 union select q.id from seen e join private.questions q on q.question_words && e.question_words
 where private.similar_word_sets(q.question_words,e.question_words)
$$;

create or replace function private.seen_question_today(room uuid,qid text,qtext text,qanswer text,qtopic text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare qkey text:=private.norm(qtext); akey text:=private.norm(qanswer); words text[]:=private.question_terms(qtext);
begin
 return exists(
 select 1 from (
 select distinct e.question_id,e.question_key,e.answer_key,e.question_words,e.topic_key
 from private.question_exposures e
 where e.play_day=(now() at time zone 'America/Sao_Paulo')::date
 and e.user_id in (select m.user_id from public.room_members m where m.room_id=room and not m.display_only)
 ) e where e.question_id=qid or e.question_key=qkey or e.answer_key=akey
 or (qtopic is not null and e.topic_key=qtopic)
 or private.similar_word_sets(e.question_words,words));
end $$;

-- Preserve authorization, versions, locks, quotas and all other game rules.
do $$
declare signature text; definition text; old_filter text:='not private.seen_question_today(room,id,question,answer,topic_key)';
begin
 foreach signature in array array[
 'private.prepare_match_before_lobby_rules(uuid,integer,text[],integer,text[],text)',
 'public.question_catalog(uuid)',
 'private.game_command(uuid,uuid,integer,uuid,text,jsonb)'
 ] loop
   definition:=pg_get_functiondef(signature::regprocedure);
   if position(old_filter in definition)=0 then raise exception 'Filtro diário não encontrado em %',signature; end if;
   definition:=replace(definition,old_filter,'id not in (select seen.id from private.room_seen_question_ids(room) seen)');
   execute definition;
 end loop;
end $$;

-- Metadata remains local to deck construction and is removed from its result.
create function private.cached_questions_similar(a jsonb,b jsonb) returns boolean
language sql immutable set search_path='' as $$
 select a->>'_question_key'=b->>'_question_key' or private.similar_word_sets(
 array(select jsonb_array_elements_text(a->'_words')),
 array(select jsonb_array_elements_text(b->'_words')))
$$;

do $$
declare definition text;
begin
 definition:=pg_get_functiondef('private.balanced_question_deck(jsonb,integer,text[],text)'::regprocedure);
 if position('private.similar_question' in definition)=0 then raise exception 'Comparação de baralho não encontrada'; end if;
 definition:=replace(definition,
 ' -- A reserva não deve diluir a distribuição das rodadas efetivamente jogadas.',
 ' select coalesce(jsonb_agg(value || jsonb_build_object(''_question_key'',private.norm(value->>''question''),''_answer_key'',private.norm(value->>''answer''),''_words'',private.question_terms(value->>''question''))),''[]''::jsonb) into remaining from jsonb_array_elements(pool);
 -- A reserva não deve diluir a distribuição das rodadas efetivamente jogadas.');
 definition:=replace(definition,'private.norm(value->>''answer'')<>private.norm(item->>''answer'')','value->>''_answer_key''<>item->>''_answer_key''');
 definition:=replace(definition,'private.similar_question(value->>''question'',item->>''question'')','private.cached_questions_similar(value,item)');
 definition:=replace(definition,' return result;',' return (select coalesce(jsonb_agg(value - ''_question_key'' - ''_answer_key'' - ''_words''),''[]''::jsonb) from jsonb_array_elements(result));');
 if position('into remaining from jsonb_array_elements(pool)' in definition)=0 then raise exception 'Preparação do cache não encontrada'; end if;
 execute definition;
end $$;

revoke all on function private.question_terms(text),private.similar_word_sets(text[],text[]),private.room_seen_question_ids(uuid),private.cached_questions_similar(jsonb,jsonb) from public,anon,authenticated;
