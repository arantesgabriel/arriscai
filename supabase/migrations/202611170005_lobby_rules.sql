-- Regras temporárias: 1–8 rodadas, seleção automática e expiração no lobby.
-- Sem cron: cada heartbeat (15s), consulta, entrada ou início remove expirados.
-- Em uma sala vazia, a próxima entrada executa a limpeza antes de contar vagas.
create function private.prune_lobby(room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rooms; removed integer; next_host uuid;
begin
 select * into r from public.rooms where id=room for update;
 if r.id is null or r.game->>'status'='active' then return; end if;
 delete from public.room_members where room_id=room and last_seen<=now()-interval '2 minutes';
 get diagnostics removed = row_count;
 if removed=0 then return; end if;
 if not exists(select 1 from public.room_members where room_id=room and user_id=r.host_id) then
   select user_id into next_host from public.room_members
   where room_id=room and not display_only and not spectator
   order by joined_at,user_id limit 1;
   if next_host is not null then
     update public.rooms set host_id=next_host,roulette=null where id=room;
   end if;
 end if;
 perform private.notify_room(room);
end $$;
revoke all on function private.prune_lobby(uuid) from public,anon,authenticated;

create or replace function public.heartbeat(room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rooms;
begin
 select * into r from public.rooms where id=room for update;
 if not private.member(room) then raise exception 'Sua presença na sala expirou. Entre novamente pelo link.'; end if;
 -- Antes de renovar, elimina também o próprio cliente se ele ultrapassou o prazo.
 perform private.prune_lobby(room);
 if not private.member(room) then return; end if;
 update public.room_members set last_seen=now() where room_id=room and user_id=auth.uid();
 if r.game->>'status'='active' and not (r.game->>'paused')::boolean and exists(
   select 1 from public.room_members where room_id=room and user_id=r.host_id and last_seen<now()-interval '45 seconds'
 ) then
   update public.rooms set game=jsonb_set(jsonb_set(game,'{paused}','true'),'{version}',to_jsonb((game->>'version')::int+1)) where id=room;
   perform private.notify_room(room);
 end if;
end $$;

-- As implementações anteriores ficam privadas; apenas as fachadas validam entrada.
alter function public.join_room(text,text,boolean) set schema private;
revoke all on function private.join_room(text,text,boolean) from public,anon,authenticated;
create function public.join_room(code text,nickname text,screen boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare room uuid;
begin
 select id into room from public.rooms where rooms.code=upper(trim(join_room.code)) for update;
 perform private.prune_lobby(room);
 room:=private.join_room(code,nickname,screen);
 if not screen then
   update public.rooms r set host_id=auth.uid(),roulette=null where r.id=room
     and coalesce(r.game->>'status','')<>'active'
     and not exists(select 1 from public.room_members m where m.room_id=r.id and m.user_id=r.host_id);
 end if;
 return room;
end $$;

alter function public.public_room_snapshot(uuid) set schema private;
alter function private.public_room_snapshot(uuid) rename to room_snapshot_before_lobby_rules;
revoke all on function private.room_snapshot_before_lobby_rules(uuid) from public,anon,authenticated;
create function public.public_room_snapshot(room uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.member(room) then raise exception 'Sua presença na sala expirou. Entre novamente pelo link.'; end if;
 perform private.prune_lobby(room);
 if not private.member(room) then raise exception 'Sua presença na sala expirou. Entre novamente pelo link.'; end if;
 return private.room_snapshot_before_lobby_rules(room);
end $$;

alter function public.prepare_match(uuid,integer,text[],integer,text[],text) set schema private;
alter function private.prepare_match(uuid,integer,text[],integer,text[],text) rename to prepare_match_before_lobby_rules;
revoke all on function private.prepare_match_before_lobby_rules(uuid,integer,text[],integer,text[],text) from public,anon,authenticated;
create function public.prepare_match(room uuid,planned integer,categories text[],exact_words integer default null,selected text[] default '{}',selection_mode text default 'automatic') returns void
language plpgsql security definer set search_path='' as $$
begin
 if planned is null or planned not between 1 and 8 then raise exception 'Escolha de 1 a 8 rodadas.'; end if;
 if selection_mode is distinct from 'automatic' or selected is null or cardinality(selected)<>0 then
   raise exception 'A seleção manual está temporariamente desativada. Use a seleção automática.';
 end if;
 if not private.member(room) then raise exception 'Acesso negado.'; end if;
 perform private.prune_lobby(room);
 perform private.prepare_match_before_lobby_rules(room,planned,categories,exact_words,'{}','automatic');
end $$;

alter function public.choose_host(uuid,uuid) set schema private;
alter function private.choose_host(uuid,uuid) rename to choose_host_before_lobby_rules;
revoke all on function private.choose_host_before_lobby_rules(uuid,uuid) from public,anon,authenticated;
create function public.choose_host(room uuid,member uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.member(room) then raise exception 'Acesso negado.'; end if;
 perform private.prune_lobby(room);
 perform private.choose_host_before_lobby_rules(room,member);
end $$;

alter function public.game_command(uuid,uuid,integer,uuid,text,jsonb) set schema private;
revoke all on function private.game_command(uuid,uuid,integer,uuid,text,jsonb) from public,anon,authenticated;
create function public.game_command(room uuid,match uuid,expected_version integer,idempotency_key uuid,command text,payload jsonb default '{}') returns void
language plpgsql security definer set search_path='' as $$
begin
 if command='adjust' and (coalesce(payload->>'rounds','') !~ '^[1-8]$') then
   raise exception 'Escolha de 1 a 8 rodadas.';
 end if;
 perform private.game_command(room,match,expected_version,idempotency_key,command,payload);
end $$;

revoke all on function public.join_room(text,text,boolean),public.public_room_snapshot(uuid),public.prepare_match(uuid,integer,text[],integer,text[],text),public.choose_host(uuid,uuid),public.game_command(uuid,uuid,integer,uuid,text,jsonb) from public,anon;
grant execute on function public.join_room(text,text,boolean),public.public_room_snapshot(uuid),public.prepare_match(uuid,integer,text[],integer,text[],text),public.choose_host(uuid,uuid),public.game_command(uuid,uuid,integer,uuid,text,jsonb) to authenticated;
