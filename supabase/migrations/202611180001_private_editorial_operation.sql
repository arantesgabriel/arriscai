-- Schema only. No catalogue text or data mutation during Preview deployment.
-- Only the database owner/admin may supply the privately reviewed text later.
create or replace function private.apply_q0710_editorial_patch(replacement text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
 approved_hash constant text := 'fa6028306fefd280473dcabcef38aae657eee5d8f8c0d3bd6e33b7aaa033ed46';
 previous_hash constant text := '417f7373e94622b25d2b89da824e8b954b8bca4b5c4838c27a0682186937f911';
 changed integer;
begin
 if replacement is null or encode(sha256(convert_to(replacement,'UTF8')),'hex') <> approved_hash then
   raise exception 'Texto editorial ausente ou não aprovado. Nenhum registro foi alterado.';
 end if;

 if exists (
   select 1 from private.questions
   where id='Q0710' and owner_id is null
     and encode(sha256(convert_to(question,'UTF8')),'hex')=approved_hash
 ) then
   return false;
 end if;

 update private.questions set question=replacement
 where id='Q0710' and owner_id is null
   and encode(sha256(convert_to(category||chr(31)||question||chr(31)||answer||chr(31)||aliases::text,'UTF8')),'hex')=previous_hash;
 get diagnostics changed = row_count;
 if changed <> 1 then
   raise exception 'Registro editorial ausente ou divergente. Nenhum registro foi alterado.';
 end if;
 return true;
end $$;

revoke all on function private.apply_q0710_editorial_patch(text) from public, anon, authenticated;
