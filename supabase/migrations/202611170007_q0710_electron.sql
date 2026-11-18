-- Correct only the known official wording. Never replace later editorial work,
-- user-owned content, aliases or review/difficulty decisions. Existing decks
-- and match history are snapshots and intentionally remain unchanged.
update private.questions
set question = 'Qual partícula de carga elétrica negativa compõe a eletrosfera dos átomos'
where id = 'Q0710'
  and owner_id is null
  and category = 'Ciência e tecnologia'
  and question = 'Qual partícula possui carga elétrica negativa'
  and answer = 'Elétron'
  and aliases = '["Eletron"]'::jsonb;
