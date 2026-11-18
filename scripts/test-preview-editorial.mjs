import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { testDatabase } from "./pg-test-runtime.mjs";

const old = "QA registro anterior preservado";
const revised = "QA registro fictício revisado para teste administrativo";
const sql = readFileSync(
  "supabase/migrations/202611180001_private_editorial_operation.sql",
  "utf8",
);
const hash = (text) => createHash("sha256").update(text).digest("hex");
const db = await testDatabase({
  afterMigration: async (file, tx) => {
    if (file.endsWith("202611170006_display_names.sql")) {
      await tx.query(
        "insert into private.questions(id,category,question,answer) values('Q0710','QA',$1,'gabarito-qa')",
        [old],
      );
    }
  },
});
const item = async () =>
  (await db.query("select * from private.questions where id='Q0710'")).rows[0];
try {
  assert.equal(
    (await item()).question,
    old,
    "automatic upgrade must preserve the existing item without session input",
  );
  const before = await item();
  for (const role of ["anon", "authenticated"]) {
    const {
      rows: [permissions],
    } = await db.query(
      "select has_function_privilege($1,'private.apply_q0710_editorial_patch(text)','execute') allowed",
      [role],
    );
    assert.equal(
      permissions.allowed,
      false,
      `${role} must not execute the private operation`,
    );
  }
  const {
    rows: [publicAcl],
  } = await db.query(
    "select count(*)::int grants from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='private.apply_q0710_editorial_patch(text)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'",
  );
  assert.equal(
    publicAcl.grants,
    0,
    "PUBLIC must not execute the private operation",
  );
  for (const input of [null, "", revised]) {
    await assert.rejects(
      db.query("select private.apply_q0710_editorial_patch($1)", [input]),
      /Texto editorial ausente ou não aprovado/,
    );
    assert.deepEqual(await item(), before);
  }
  // Same function body, synthetic fingerprints only: no real catalogue payload.
  const synthetic = sql
    .replaceAll(
      "private.apply_q0710_editorial_patch",
      "private.apply_test_editorial_patch",
    )
    .replace(
      /approved_hash constant text := '[a-f0-9]+'/,
      `approved_hash constant text := '${hash(revised)}'`,
    )
    .replace(
      /previous_hash constant text := '[a-f0-9]+'/,
      `previous_hash constant text := '${hash(["QA", old, "gabarito-qa", "[]"].join(String.fromCharCode(31)))}'`,
    );
  await db.exec(synthetic);
  const apply = () =>
    db.query("select private.apply_test_editorial_patch($1) applied", [
      revised,
    ]);
  assert.equal((await apply()).rows[0].applied, true);
  assert.equal((await item()).question, revised);
  assert.equal(
    (await apply()).rows[0].applied,
    false,
    "replay must not overwrite an already-corrected item",
  );
  const owner = randomUUID();
  await db.query("insert into auth.users values($1)", [owner]);
  for (const mutation of [
    "question='QA revisão posterior'",
    "category='QA outra categoria'",
    "answer='QA outro gabarito'",
    "aliases='[\"QA outro alias\"]'::jsonb",
    `owner_id='${owner}'`,
  ]) {
    await db.query(
      "update private.questions set category='QA',question=$1,answer='gabarito-qa',aliases='[]',owner_id=null where id='Q0710'",
      [old],
    );
    await db.exec(`update private.questions set ${mutation} where id='Q0710'`);
    const previous = await item();
    await assert.rejects(apply(), /Registro editorial ausente ou divergente/);
    assert.deepEqual(await item(), previous);
  }
  await db.exec("delete from private.questions where id='Q0710'");
  await assert.rejects(apply(), /Registro editorial ausente ou divergente/);
  // A branch that already ran 007 also receives the operation through the new migration.
  await db.exec(sql);
  console.log(
    "PASS Preview upgrade with an existing item and no session input; private ACL; invalid input; synthetic apply/replay; editorial and owner guards; missing item; schema migration replay.",
  );
} finally {
  await db.close();
}
