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
