-- One authoritative room transition keeps every device on the same screen.
create function public.return_to_lobby(room uuid, match uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rooms;
begin
 select * into r from public.rooms where id=room for update;
 if not private.member(room) or r.host_id<>auth.uid() then raise exception 'Somente organizador.'; end if;
 if r.game is null and exists(select 1 from public.room_match_history where id=match and room_id=room) then return; end if;
 if r.game->>'id' is distinct from match::text or r.game->>'status' is distinct from 'completed' then
   raise exception 'Conclua a partida antes de voltar ao lobby.';
 end if;
 update public.room_members set spectator=display_only,last_seen=now() where room_id=room;
 update public.rooms set game=null,roulette=null where id=room;
 perform private.notify_room(room);
end $$;
revoke all on function public.return_to_lobby(uuid,uuid) from public,anon;
grant execute on function public.return_to_lobby(uuid,uuid) to authenticated;
