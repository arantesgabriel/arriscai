-- Player guesses share the existing room lock, version and action deduplication.
-- Only a guess is public; answer/aliases/comparison remain in private.decks.
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

 if command='pause' then
   g := g||'{"paused":true}';
 elsif command='resume' then
   g := g||'{"paused":false}';
 elsif command='cancel' then
   g := g||'{"status":"cancelled"}';
   update public.room_members set spectator=display_only where room_id=room;
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
   where (owner_id is null or owner_id=auth.uid())
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
     g := private.round_state(g - 'live_guess' - 'feedback', d.questions->idx, idx);
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
