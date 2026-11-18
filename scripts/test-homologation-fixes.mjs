import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./pg-test-runtime.mjs";
import { correctCatalogQuestion } from "./catalog-correction.mjs";
import { readFileSync } from "node:fs";

const db = await testDatabase();
const old = "QA enunciado anterior do item fictício";
const corrected =
  "QA enunciado revisado com pistas fictícias destinado somente ao teste local";
const patch = {
  id: "QA_0710",
  category: "Ciência e tecnologia",
  previousQuestion: old,
  question: corrected,
  answer: "gabarito-0710",
  aliases: ["alias-0710"],
};
const apply = () => correctCatalogQuestion(db, patch);
try {
  const privatePatch = readFileSync(
    "supabase/migrations/202611170007_private_editorial_patch.sql",
    "utf8",
  );
  await db.query(
    "insert into private.questions(id,category,question,answer) values('Q0710','QA','QA registro fictício protegido','gabarito-qa')",
  );
  await assert.rejects(db.exec(privatePatch), /Configure o texto editorial/);
  await db.query(
    "select set_config('arriscai.editorial_q0710','QA entrada não aprovada',false)",
  );
  await assert.rejects(db.exec(privatePatch), /Configure o texto editorial/);
  assert.equal(
    (await db.query("select question from private.questions where id='Q0710'"))
      .rows[0].question,
    "QA registro fictício protegido",
  );
  await db.exec("delete from private.questions where id='Q0710'");
  await db.query(
    "update private.questions set question=$1 where id='QA_0710'",
    [old],
  );
  await apply();
  const question = async () =>
    (await db.query("select * from private.questions where id='QA_0710'"))
      .rows[0];
  assert.equal((await question()).question, corrected);
  assert.equal(corrected.split(/\s+/).length, 11);
  assert.deepEqual((await question()).aliases, ["alias-0710"]);
  await apply();
  assert.equal((await question()).question, corrected);
  for (const mutation of [
    "question='Revisão editorial posterior'",
    "answer='Outra resposta'",
    "aliases='[\"Outro alias\"]'::jsonb",
    "category='História'",
  ]) {
    await db.query(
      "update private.questions set question=$1,answer='gabarito-0710',aliases='[\"alias-0710\"]',category='Ciência e tecnologia' where id='QA_0710'",
      [old],
    );
    await db.exec(
      `update private.questions set ${mutation} where id='QA_0710'`,
    );
    const before = await question();
    await apply();
    assert.deepEqual(await question(), before);
  }
  const host = randomUUID(),
    a = randomUUID(),
    b = randomUUID();
  for (const id of [host, a, b])
    await db.query("insert into auth.users values($1)", [id]);
  await db.query(
    "update private.questions set owner_id=$1,question=$2,answer='gabarito-0710',aliases='[\"alias-0710\"]',category='Ciência e tecnologia' where id='QA_0710'",
    [host, old],
  );
  await apply();
  assert.equal((await question()).question, old);
  async function as(id, sql, args = []) {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        id,
      ]);
      await tx.exec("set local role authenticated");
      return (await tx.query(sql, args)).rows[0];
    });
  }
  const { room } = await as(host, "select public.create_room('Telão') room");
  const { code } = (
    await db.query("select code from public.rooms where id=$1", [room])
  ).rows[0];
  // Independent identities, competing requests; PGlite serializes transactions.
  // Hosted PostgreSQL concurrency is a separate validation requirement.
  await Promise.all(
    [a, b].map((id) =>
      as(id, "select public.join_room($1,'Telão',true)", [code]),
    ),
  );
  let members = (
    await db.query(
      "select * from public.room_members where room_id=$1 order by nickname",
      [room],
    )
  ).rows;
  assert.deepEqual(
    members.map((m) => m.nickname),
    ["Telão", "Telão 2", "Telão 3"],
  );
  for (const m of members.filter((m) => m.user_id !== host)) {
    assert(m.spectator && m.display_only);
  }
  await as(a, "select public.join_room($1,'Outro nome',true)", [code]);
  assert.deepEqual(
    (
      await db.query(
        "select nickname from public.room_members where room_id=$1 and user_id=$2",
        [room, a],
      )
    ).rows,
    [{ nickname: "Telão 2" }],
  );
  const c = randomUUID();
  await db.query("insert into auth.users values($1)", [c]);
  await assert.rejects(
    as(c, "select public.join_room($1,'Telão',false)", [code]),
    /unique|duplicate/i,
  );
  const longName = "ABCDEFGHIJKLMNOPQRSTUVWX";
  await as(c, "select public.join_room($1,$2,false)", [code, longName]);
  const d = randomUUID();
  await db.query("insert into auth.users values($1)", [d]);
  await as(d, "select public.join_room($1,$2,true)", [code, longName]);
  const {
    rows: [longDisplay],
  } = await db.query(
    "select nickname,display_only,spectator from public.room_members where room_id=$1 and user_id=$2",
    [room, d],
  );
  assert.equal(longDisplay.nickname, "ABCDEFGHIJKLMNOPQRSTUV 2");
  assert.equal(longDisplay.nickname.length, 24);
  assert(longDisplay.display_only && longDisplay.spectator);
  console.log(
    "PASS synthetic editorial correction: existing record, replay, later wording, answer, aliases, category and owner guards. PASS display allocation, occupied player name, reconnect and player uniqueness (local SQL).",
  );
} finally {
  await db.close();
}
