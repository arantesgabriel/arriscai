-- Preserve player nickname uniqueness and all join guards.
create or replace function public.join_room(code text,nickname text,screen boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare room uuid; available_name text := trim(nickname); suffix integer := 1; existing_name text;
begin
 select id into room from public.rooms where rooms.code=upper(trim(join_room.code)) for update;
 perform private.prune_lobby(room);
 -- The room row lock serializes simultaneous display name allocation.
 -- Returning Auth identities keep their original membership and name.
 if screen then
   select m.nickname into existing_name from public.room_members m
     where m.room_id=room and m.user_id=auth.uid();
   if existing_name is not null then
     available_name:=existing_name;
   else
     while exists(select 1 from public.room_members m where m.room_id=room and m.nickname=available_name) loop
       suffix:=suffix+1;
       available_name:=left(trim(nickname),24-length(suffix::text)-1)||' '||suffix::text;
     end loop;
   end if;
 end if;
 room:=private.join_room(code,available_name,screen);
 if not screen then
   update public.rooms r set host_id=auth.uid(),roulette=null where r.id=room
     and coalesce(r.game->>'status','')<>'active'
     and not exists(select 1 from public.room_members m where m.room_id=r.id and m.user_id=r.host_id);
 end if;
 return room;
end $$;
