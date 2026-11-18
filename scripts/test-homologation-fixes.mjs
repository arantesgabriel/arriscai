import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { testDatabase } from "./pg-test-runtime.mjs";

const db = await testDatabase();
const editorial = readFileSync(
  "supabase/migrations/202611170007_q0710_electron.sql",
  "utf8",
);
const old = "Qual partícula possui carga elétrica negativa";
const corrected =
  "Qual partícula de carga elétrica negativa compõe a eletrosfera dos átomos";
try {
  await db.query("update private.questions set question=$1 where id='Q0710'", [
    old,
  ]);
  await db.exec(editorial);
  const question = async () =>
    (await db.query("select * from private.questions where id='Q0710'"))
      .rows[0];
  assert.equal((await question()).question, corrected);
  assert.equal(corrected.split(/\s+/).length, 11);
  assert.deepEqual((await question()).aliases, ["Eletron"]);
  await db.exec(editorial);
  assert.equal((await question()).question, corrected);
  for (const mutation of [
    "question='Revisão editorial posterior'",
    "answer='Outra resposta'",
    "aliases='[\"Outro alias\"]'::jsonb",
    "category='História'",
  ]) {
    await db.query(
      "update private.questions set question=$1,answer='Elétron',aliases='[\"Eletron\"]',category='Ciência e tecnologia' where id='Q0710'",
      [old],
    );
    await db.exec(`update private.questions set ${mutation} where id='Q0710'`);
    const before = await question();
    await db.exec(editorial);
    assert.deepEqual(await question(), before);
  }
  const host = randomUUID(),
    a = randomUUID(),
    b = randomUUID();
  for (const id of [host, a, b])
    await db.query("insert into auth.users values($1)", [id]);
  await db.query(
    "update private.questions set owner_id=$1,question=$2,answer='Elétron',aliases='[\"Eletron\"]',category='Ciência e tecnologia' where id='Q0710'",
    [host, old],
  );
  await db.exec(editorial);
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
    "PASS Q0710: existing record, replay, later wording, answer, aliases, category and owner guards; 11 words. PASS display allocation, occupied player name, reconnect and player uniqueness (local SQL).",
  );
} finally {
  await db.close();
}
