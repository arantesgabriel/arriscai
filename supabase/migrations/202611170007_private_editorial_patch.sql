-- The approved text is supplied in the private administrator session only.
-- Never mark this patch applied to an existing item without its private input.
do $$
declare replacement text;
begin
 if not exists(select 1 from private.questions where id='Q0710') then return; end if;
 if exists(select 1 from private.questions where id='Q0710' and owner_id is null and encode(sha256(convert_to(question,'UTF8')),'hex')='fa6028306fefd280473dcabcef38aae657eee5d8f8c0d3bd6e33b7aaa033ed46') then return; end if;
 replacement:=nullif(current_setting('arriscai.editorial_q0710',true),'');
 if replacement is null or encode(sha256(convert_to(replacement,'UTF8')),'hex')<>'fa6028306fefd280473dcabcef38aae657eee5d8f8c0d3bd6e33b7aaa033ed46' then
   raise exception 'Configure o texto editorial aprovado na sessão administrativa privada antes de aplicar esta migration.';
 end if;
 update private.questions set question=replacement
 where id='Q0710' and owner_id is null
 and encode(sha256(convert_to(category||chr(31)||question||chr(31)||answer||chr(31)||aliases::text,'UTF8')),'hex')='417f7373e94622b25d2b89da824e8b954b8bca4b5c4838c27a0682186937f911';
end $$;
