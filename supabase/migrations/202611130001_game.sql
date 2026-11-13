create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.settings (singleton boolean primary key default true check(singleton), allow_provisional boolean not null default false);
insert into private.settings values(true,false);
create table public.rooms (
 id uuid primary key default gen_random_uuid(), code text unique not null,
 host_id uuid not null references auth.users(id), game jsonb,
 created_at timestamptz not null default now()
);
create table public.room_members (
 room_id uuid references public.rooms(id) on delete cascade,
 user_id uuid references auth.users(id), nickname text not null check(length(nickname) between 1 and 24),
 spectator boolean not null default false, display_only boolean not null default false, joined_at timestamptz not null default now(), last_seen timestamptz not null default now(),
 primary key(room_id,user_id), unique(room_id,nickname)
);
create table private.questions (
 id text primary key default gen_random_uuid()::text, owner_id uuid references auth.users(id),
 category text not null, question text not null, answer text not null, aliases jsonb not null default '[]',
 review_status text not null default 'provisional' check(review_status in ('provisional','approved')),
 check(length(question) between 1 and 1500), check(length(answer) between 1 and 200),
 check(position('?' in question)=0), check(jsonb_typeof(aliases)='array')
);
create table private.decks (match_id uuid primary key, room_id uuid references public.rooms(id), questions jsonb not null, guess jsonb);
create table private.actions (
 match_id uuid not null, key uuid not null, actor uuid not null, command text not null, payload jsonb not null,
 version integer not null, created_at timestamptz not null default now(), primary key(match_id,key)
);
create table public.room_match_history (
 id uuid primary key, room_id uuid references public.rooms(id), scores jsonb not null, ended_at timestamptz not null default now()
);
create table private.rate_limits (uid uuid, bucket text, started timestamptz not null, hits integer not null, primary key(uid,bucket));
create function private.member(r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.room_members where room_id=r and user_id=auth.uid())
$$;
create function private.throttle(rate_bucket text, maximum integer) returns void language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 insert into private.rate_limits values(auth.uid(),rate_bucket,clock_timestamp(),1)
 on conflict(uid,bucket) do update set hits=case when private.rate_limits.started < clock_timestamp()-interval '1 minute' then 1 else private.rate_limits.hits+1 end,
 started=case when private.rate_limits.started < clock_timestamp()-interval '1 minute' then clock_timestamp() else private.rate_limits.started end returning hits into n;
 if n>maximum then raise exception 'Muitas tentativas. Aguarde um minuto.'; end if;
end $$;
create function private.tokens(t text) returns text[] language sql immutable set search_path='' as $$
 select array_agg(x) from regexp_split_to_table(trim(regexp_replace(t,'\?','','g')),'\s+') x where x ~ '[[:alnum:]]'
$$;
create function private.norm(t text) returns text language sql immutable set search_path='' as $$
 select trim(regexp_replace(lower(translate(t,'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),'[^a-z0-9]+',' ','g'))
$$;
create function private.notify_room(r uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform realtime.send(jsonb_build_object('room_id',r),'state_changed','room:'||r::text,true); end $$;
create function public.create_room(nickname text) returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid; c text;
begin
 perform private.throttle('create',5);
 c:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.rooms(code,host_id) values(c,auth.uid()) returning id into r;
 insert into public.room_members(room_id,user_id,nickname) values(r,auth.uid(),trim(nickname));
 return r;
end $$;
create function public.join_room(code text,nickname text,screen boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.rooms;
begin
 perform private.throttle('join',20);
 select * into r from public.rooms where rooms.code=upper(trim(join_room.code)) for update;
 if r.id is null then raise exception 'Sala não encontrada.'; end if;
 if (select count(*) from public.room_members where room_id=r.id)>=50 and not private.member(r.id) then raise exception 'Sala cheia.'; end if;
 insert into public.room_members(room_id,user_id,nickname,spectator,display_only) values(r.id,auth.uid(),trim(nickname),screen or coalesce(r.game->>'status'='active',false),screen)
 on conflict(room_id,user_id) do update set last_seen=now();
 perform private.notify_room(r.id); return r.id;
end $$;
create function public.public_room_snapshot(room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rooms; members jsonb; history jsonb;
begin
 if not private.member(room) then raise exception 'Acesso negado.'; end if;
 select * into r from public.rooms where id=room;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'nickname',nickname,'spectator',spectator,'last_seen',last_seen) order by joined_at,user_id),'[]') into members from public.room_members where room_id=room;
 select coalesce(jsonb_agg(to_jsonb(h)-'room_id'),'[]') into history from (select * from public.room_match_history where room_id=room order by ended_at desc limit 10) h;
 return jsonb_build_object('id',r.id,'code',r.code,'host_id',r.host_id,'members',members,'game',r.game,'history',history);
end $$;
create function public.heartbeat(room uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.rooms;
begin
 if not private.member(room) then raise exception 'Acesso negado.'; end if;
 select * into r from public.rooms where id=room for update;
 update public.room_members set last_seen=now() where room_id=room and user_id=auth.uid();
 if r.game->>'status'='active' and not (r.game->>'paused')::boolean and exists(select 1 from public.room_members where room_id=room and user_id=r.host_id and last_seen<now()-interval '45 seconds') then
  update public.rooms set game=jsonb_set(jsonb_set(game,'{paused}','true'),'{version}',to_jsonb((game->>'version')::int+1)) where id=room;
  perform private.notify_room(room);
 end if;
end $$;
create function public.choose_host(room uuid, member uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare r public.rooms; h uuid;
begin
 perform private.throttle('host',20);
 select * into r from public.rooms where id=room for update;
 if r.host_id<>auth.uid() or not private.member(room) or r.game->>'status'='active' then raise exception 'Organizador só pode mudar entre partidas.'; end if;
 select user_id into h from public.room_members where room_id=room and not spectator and (member is null or user_id=member) order by random() limit 1;
 if h is null then raise exception 'Escolha um participante.'; end if;
 update public.rooms set host_id=h where id=room;
 perform private.notify_room(room);
end $$;
create function public.question_catalog(room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.rooms where id=room and host_id=auth.uid()) then raise exception 'Somente organizador.'; end if;
 -- Host receives catalog only outside an active match. Official IDs are never in public snapshots.
 if exists(select 1 from public.rooms where id=room and game->>'status'='active') then raise exception 'Catálogo fechado durante a partida.'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'category',category,'question',question,'word_count',cardinality(private.tokens(question)),'own',owner_id is not null)),'[]') from private.questions where (owner_id is null or owner_id=auth.uid()) and (review_status='approved' or (select allow_provisional from private.settings where singleton) or owner_id=auth.uid()));
end $$;
create function public.save_question(room uuid, question text, answer text, category text, aliases jsonb default '[]', question_id text default null) returns text language plpgsql security definer set search_path='' as $$
declare q text; i text;
begin
 perform private.throttle('question',15);
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception 'Conta permanente obrigatória.'; end if;
 if not exists(select 1 from public.rooms where id=room and host_id=auth.uid() and (game is null or game->>'status'<>'active')) then raise exception 'Edite perguntas antes da partida.'; end if;
 q:=array_to_string(private.tokens(question),' ');
 if coalesce(cardinality(private.tokens(q)),0) not between 1 and 22 or coalesce(length(trim(answer)),0)=0 or jsonb_array_length(aliases)>20 or length(aliases::text)>2000 or exists(select 1 from jsonb_array_elements(aliases) x where jsonb_typeof(x)<>'string') then raise exception 'Use de 1 a 22 palavras, uma resposta e até 20 aliases curtos.'; end if;
 if question_id is null then
 insert into private.questions(owner_id,category,question,answer,aliases,review_status) values(auth.uid(),left(category,80),q,trim(answer),aliases,'approved') returning id into i;
 else
 update private.questions set question=q,answer=trim(save_question.answer),category=left(save_question.category,80),aliases=save_question.aliases where id=question_id and owner_id=auth.uid() returning id into i;
 if i is null then raise exception 'Pergunta não pertence a você.'; end if;
 end if;
 return i;
end $$;
create function public.host_private_round_snapshot(room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rooms; d private.decks; q jsonb;
begin
 select * into r from public.rooms where id=room;
 if r.host_id<>auth.uid() or not private.member(room) then raise exception 'Somente organizador.'; end if;
 select * into d from private.decks where match_id=(r.game->>'id')::uuid;
 q:=d.questions->((r.game->>'round')::int);
 return jsonb_build_object('question',q->>'question','answer',q->>'answer','aliases',q->'aliases','guess',d.guess->>'text','suggested',d.guess->'suggested');
end $$;
create function public.own_question_snapshot(room uuid, question_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare q jsonb;
begin
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) or not exists(select 1 from public.rooms where id=room and host_id=auth.uid() and (game is null or game->>'status'<>'active')) then raise exception 'Conta permanente e preparação obrigatórias.'; end if;
 select jsonb_build_object('question',question,'answer',answer,'aliases',aliases,'category',category) into q from private.questions where id=question_id and owner_id=auth.uid();
 if q is null then raise exception 'Pergunta não pertence a você.'; end if;
 return q;
end $$;
create function private.round_state(g jsonb,q jsonb,idx integer) returns jsonb language plpgsql immutable set search_path='' as $$
declare words jsonb;
begin
 select jsonb_agg('null'::jsonb) into words from unnest(private.tokens(q->>'question'));
 return g||jsonb_build_object('round',idx,'phase','awaiting_position','words',words,'current',idx%jsonb_array_length(g->'players'),'selected',null,'last',null,'category',q->>'category','result',null);
end $$;
create function public.prepare_match(room uuid, planned integer, categories text[], exact_words integer default null, selected text[] default '{}', selection_mode text default 'automatic') returns void language plpgsql security definer set search_path='' as $$
declare r public.rooms; deck jsonb; players jsonb; mid uuid:=gen_random_uuid();
begin
 perform private.throttle('prepare',10);
 select * into r from public.rooms where id=room for update;
 if not private.member(room) or r.host_id<>auth.uid() or r.game->>'status'='active' then raise exception 'Preparação indisponível.'; end if;
 if planned is null or planned not between 1 and 30 or exact_words not between 1 and 22 or selection_mode is null or selection_mode not in ('automatic','manual','mixed') then raise exception 'Configuração inválida.'; end if;
 if cardinality(selected)<>(select count(distinct x) from unnest(selected) x) then raise exception 'Não repita perguntas.'; end if;
 select jsonb_agg(jsonb_build_object('id',user_id,'nickname',nickname,'score',0) order by joined_at,user_id) into players from public.room_members where room_id=room and user_id<>r.host_id and not spectator;
 if players is null then raise exception 'Convide pelo menos um jogador.'; end if;
 with candidates as (
 select *, array_position(selected,id) priority from private.questions where (owner_id is null or owner_id=auth.uid())
 and (review_status='approved' or (select allow_provisional from private.settings where singleton) or owner_id=auth.uid())
 and category=any(categories) and (exact_words is null or cardinality(private.tokens(question))=exact_words)
 and cardinality(private.tokens(question)) between 1 and 22
 and (selection_mode<>'manual' or id=any(selected))
 ), ordered as (select * from candidates order by priority nulls last,random() limit planned+5)
 select jsonb_agg(jsonb_build_object('id',id,'question',question,'answer',answer,'aliases',aliases,'category',category)) into deck from ordered;
 if coalesce(jsonb_array_length(deck),0)<planned then raise exception 'Perguntas insuficientes para esses filtros. Reduza rodadas ou amplie categorias.'; end if;
 if selection_mode<>'automatic' and (select count(*) from jsonb_array_elements(deck) q where q->>'id'=any(selected))<>cardinality(selected) then raise exception 'Seleção incompatível com filtros ou limite.'; end if;
 insert into private.decks(match_id,room_id,questions) values(mid,room,deck);
 update public.rooms set game=private.round_state(jsonb_build_object('id',mid,'host',r.host_id,'status','active','version',1,'paused',false,'planned',planned,'prepared',jsonb_array_length(deck),'players',players,'winner',null),deck->0,0) where id=room;
 perform private.notify_room(room);
end $$;
create function public.game_command(room uuid, match uuid, expected_version integer, idempotency_key uuid, command text, payload jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare r public.rooms; g jsonb; d private.decks; a private.actions; q jsonb; idx integer; n integer; cnt integer; cur integer; ps jsonb; p jsonb; v integer; top_score integer; leaders integer; win text; guess_text text; suggestion boolean; target uuid;
begin
 perform private.throttle('command',180);
 if payload is null or jsonb_typeof(payload)<>'object' or length(payload::text)>4000 then raise exception 'Comando inválido ou muito extenso.'; end if;
 select * into r from public.rooms where id=room for update;
 if not private.member(room) or r.host_id<>auth.uid() then raise exception 'Somente organizador.'; end if;
 g:=r.game;
 if g is null or g->>'id'<>match::text then raise exception 'Partida incorreta.'; end if;
 select * into a from private.actions where match_id=match and key=idempotency_key;
 if found then
 if a.actor<>auth.uid() or a.command<>game_command.command or a.payload<>game_command.payload then raise exception 'Chave reutilizada com outro comando.'; end if;
 return; end if;
 v:=(g->>'version')::int;
 if expected_version is null or v<>expected_version then raise exception 'Conflito de versão. Estado atualizado; tente novamente.'; end if;
 if g->>'status'<>'active' then raise exception 'Partida encerrada.'; end if;
 if (g->>'paused')::boolean and command not in ('resume','cancel') then raise exception 'Partida pausada.'; end if;
 if command not in ('pause','resume','cancel') and exists(select 1 from public.room_members where room_id=room and user_id=r.host_id and last_seen<now()-interval '45 seconds') then raise exception 'Reconecte e retome a partida.'; end if;
 select * into d from private.decks where match_id=match;
 q:=d.questions->((g->>'round')::int); n:=jsonb_array_length(g->'words'); cur:=(g->>'current')::int;
 select count(*) into cnt from jsonb_array_elements(g->'words') w where w<>'null'::jsonb;
 if command='pause' then g:=g||'{"paused":true}';
 elsif command='resume' then g:=g||'{"paused":false}';
 elsif command='cancel' then g:=g||'{"status":"cancelled"}';
 elsif command='select' then
  idx:=(payload->>'position')::int;
  if g->>'phase'<>'awaiting_position' or idx is null or idx<0 or idx>=n or g->'words'->idx<>'null'::jsonb then raise exception 'Posição indisponível.'; end if;
  g:=g||jsonb_build_object('selected',idx,'phase','pending_confirmation');
 elsif command='cancel_selection' then
  if g->>'phase'<>'pending_confirmation' then raise exception 'Não há seleção.'; end if;
  g:=g||'{"selected":null,"phase":"awaiting_position"}';
 elsif command='reveal' then
  if g->>'phase'<>'pending_confirmation' then raise exception 'Selecione e confirme uma posição.'; end if;
  idx:=(g->>'selected')::int;
  g:=jsonb_set(g,array['words',idx::text],to_jsonb((private.tokens(q->>'question'))[idx+1]))||jsonb_build_object('phase','awaiting_guess','last',idx,'selected',null);
  update private.decks set guess=null where match_id=match;
 elsif command='undo' then
  if g->>'phase'<>'awaiting_guess' or g->>'last' is null or d.guess is not null then raise exception 'Desfazer indisponível após registrar palpite.'; end if;
  idx:=(g->>'last')::int; g:=jsonb_set(g,array['words',idx::text],'null')||'{"phase":"awaiting_position","last":null}';
 elsif command='guess' then
  if g->>'phase'<>'awaiting_guess' or coalesce(length(trim(payload->>'text')),0) not between 1 and 200 then raise exception 'Registre o palpite da vez.'; end if;
  guess_text:=trim(payload->>'text');
  suggestion:=private.norm(guess_text)=private.norm(q->>'answer') or exists(select 1 from jsonb_array_elements_text(q->'aliases') x where private.norm(x)=private.norm(guess_text));
  update private.decks set guess=jsonb_build_object('text',guess_text,'suggested',suggestion,'player',g->'players'->cur->>'id') where match_id=match;
 elsif command in ('judge','pass','skip') then
  if command='skip' then
   target:=(g->'players'->cur->>'id')::uuid;
   if g->>'phase'<>'awaiting_position' or exists(select 1 from public.room_members where room_id=room and user_id=target and last_seen>=now()-interval '45 seconds') then raise exception 'Jogador ainda conectado ou jogada em curso.'; end if;
  elsif g->>'phase'<>'awaiting_guess' then raise exception 'Aguarde a revelação.'; end if;
  if command='judge' and (d.guess is null or jsonb_typeof(payload->'correct') is distinct from 'boolean') then raise exception 'Registre palpite e decisão humana.'; end if;
  if command='judge' and (payload->>'correct')::boolean then
   ps:=g->'players'; p:=ps->cur; p:=p||jsonb_build_object('score',(p->>'score')::int+n-cnt+1);
   g:=jsonb_set(g,array['players',cur::text],p)||jsonb_build_object('phase','result','result',p->>'id');
  elsif cnt=n then g:=g||'{"phase":"result","result":null}';
  else g:=g||jsonb_build_object('phase','awaiting_position','current',(cur+1)%jsonb_array_length(g->'players'),'last',null); end if;
  if g->>'phase'='result' then g:=g||jsonb_build_object('words',to_jsonb(private.tokens(q->>'question'))); end if;
 elsif command='adjust' then
  idx:=(payload->>'rounds')::int;
  if idx is null or idx<(g->>'round')::int+1 or idx>jsonb_array_length(d.questions) then raise exception 'Use apenas rodadas previamente preparadas.'; end if;
  g:=g||jsonb_build_object('planned',idx);
 elsif command='reserve_custom' then
  if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception 'Conta permanente obrigatória.'; end if;
  if g->>'phase'<>'result' or (g->>'round')::int+1<jsonb_array_length(d.questions) then raise exception 'Prepare a pergunta extra somente após esgotar a reserva.'; end if;
  if coalesce(cardinality(private.tokens(payload->>'question')),0) not between 1 and 22 or coalesce(length(trim(payload->>'answer')),0) not between 1 and 200 then raise exception 'Use de 1 a 22 palavras e uma resposta.'; end if;
  if exists(select 1 from jsonb_array_elements(d.questions) z where private.norm(z->>'question')=private.norm(array_to_string(private.tokens(payload->>'question'),' '))) then raise exception 'Pergunta já usada nesta partida.'; end if;
  q:=jsonb_build_object('id',gen_random_uuid()::text,'question',array_to_string(private.tokens(payload->>'question'),' '),'answer',trim(payload->>'answer'),'aliases','[]'::jsonb,'category','Pergunta própria');
  insert into private.questions(id,owner_id,question,answer,category,aliases,review_status) values(q->>'id',auth.uid(),q->>'question',q->>'answer',q->>'category','[]','approved');
  update private.decks set questions=questions||jsonb_build_array(q) where match_id=match;
  g:=g||jsonb_build_object('prepared',jsonb_array_length(d.questions)+1);
 elsif command='reserve' then
  if g->>'phase'<>'result' or (g->>'round')::int+1<jsonb_array_length(d.questions) then raise exception 'Reserva ainda disponível ou rodada em curso.'; end if;
  select jsonb_build_object('id',id,'question',question,'answer',answer,'aliases',aliases,'category',category) into q from private.questions where (owner_id is null or owner_id=auth.uid()) and (review_status='approved' or (select allow_provisional from private.settings where singleton) or owner_id=auth.uid()) and not exists(select 1 from jsonb_array_elements(d.questions) z where z->>'id'=questions.id) order by random() limit 1;
  if q is null then raise exception 'Catálogo esgotado. Cancele e amplie o catálogo antes de outra partida.'; end if;
  update private.decks set questions=questions||jsonb_build_array(q) where match_id=match;
  g:=g||jsonb_build_object('prepared',jsonb_array_length(d.questions)+1);
 elsif command='next' then
  if g->>'phase'<>'result' then raise exception 'Conclua a rodada antes de avançar.'; end if;
  select max((x->>'score')::int) into top_score from jsonb_array_elements(g->'players') x;
  select count(*),min(x->>'id') into leaders,win from jsonb_array_elements(g->'players') x where (x->>'score')::int=top_score;
  idx:=(g->>'round')::int+1;
  if idx>=(g->>'planned')::int and leaders=1 then
   g:=g||jsonb_build_object('status','completed','winner',win);
   insert into public.room_match_history(id,room_id,scores) values(match,room,g->'players');
   update public.room_members set spectator=display_only where room_id=room;
  else
   if idx>=jsonb_array_length(d.questions) then raise exception 'Empate sem reserva. Prepare uma pergunta extra.'; end if;
   g:=private.round_state(g,d.questions->idx,idx);
   update private.decks set guess=null where match_id=match;
  end if;
 else raise exception 'Comando desconhecido.';
 end if;
 g:=g||jsonb_build_object('version',v+1);
 update public.rooms set game=g where id=room;
 insert into private.actions values(match,idempotency_key,auth.uid(),command,payload,v+1,now());
 perform private.notify_room(room);
end $$;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_match_history enable row level security;
alter table private.questions enable row level security;
alter table private.decks enable row level security;
alter table private.actions enable row level security;
alter table private.rate_limits enable row level security;
alter table private.settings enable row level security;
create policy room_read on public.rooms for select to authenticated using(private.member(id));
create policy members_read on public.room_members for select to authenticated using(private.member(room_id));
create policy history_read on public.room_match_history for select to authenticated using(private.member(room_id));
grant usage on schema private to authenticated;
grant execute on function private.member(uuid) to authenticated;
revoke all on public.rooms,public.room_members,public.room_match_history from anon,authenticated;
grant select on public.rooms,public.room_members,public.room_match_history to authenticated;
revoke execute on function public.create_room(text),public.join_room(text,text,boolean),public.public_room_snapshot(uuid),public.heartbeat(uuid),public.choose_host(uuid,uuid),public.question_catalog(uuid),public.save_question(uuid,text,text,text,jsonb,text),public.host_private_round_snapshot(uuid),public.own_question_snapshot(uuid,text),public.prepare_match(uuid,integer,text[],integer,text[],text),public.game_command(uuid,uuid,integer,uuid,text,jsonb) from public,anon;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.member(uuid) to authenticated;
grant execute on function public.create_room(text),public.join_room(text,text,boolean),public.public_room_snapshot(uuid),public.heartbeat(uuid),public.choose_host(uuid,uuid),public.question_catalog(uuid),public.save_question(uuid,text,text,text,jsonb,text),public.host_private_round_snapshot(uuid),public.own_question_snapshot(uuid,text),public.prepare_match(uuid,integer,text[],integer,text[],text),public.game_command(uuid,uuid,integer,uuid,text,jsonb) to authenticated;
-- Private Broadcast and Presence authorization. Clients can publish only Presence.
create policy room_broadcast_read on realtime.messages for select to authenticated
using (extension in ('broadcast','presence') and exists(select 1 from public.room_members m where m.user_id=auth.uid() and 'room:'||m.room_id::text=realtime.topic()));
create policy room_presence_write on realtime.messages for insert to authenticated
with check (extension='presence' and exists(select 1 from public.room_members m where m.user_id=auth.uid() and 'room:'||m.room_id::text=realtime.topic()));
