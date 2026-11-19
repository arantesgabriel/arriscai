import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { testDatabase } from "./pg-test-runtime.mjs";

const db = await testDatabase();
const users = Array.from({ length: 14 }, () => randomUUID());
const host = users[0];
async function rpc(name, args) {
  return db.transaction(async (tx) => {
    await tx.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
      [host, JSON.stringify({ sub: host, is_anonymous: true })],
    );
    await tx.exec(
      "set local role authenticated; set local statement_timeout='8s'",
    );
    return (
      await tx.query(
        `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) value`,
        args,
      )
    ).rows[0].value;
  });
}
try {
  for (const id of users)
    await db.query("insert into auth.users values($1)", [id]);
  await db.exec("update private.settings set allow_provisional=true");
  const room = await rpc("create_room", ["Host"]);
  for (const [index, id] of users.slice(1).entries())
    await db.query(
      "insert into public.room_members(room_id,user_id,nickname) values($1,$2,$3)",
      [room, id, `Player ${index + 1}`],
    );
  await db.exec(
    "insert into private.questions(id,category,question,answer,aliases,review_status,difficulty,complexity_score) select 'EXTRA_'||id,category,replace(question,'QA','QB'),'extra-'||answer,aliases,review_status,difficulty,complexity_score from private.questions order by id limit 500",
  );
  assert.equal(
    (await db.query("select count(*)::int n from private.questions")).rows[0].n,
    1004,
  );
  await db.query(
    "insert into private.question_exposures(user_id,question_id,question,answer) select m.user_id,q.id,q.question,q.answer from public.room_members m cross join (select * from private.questions where id like 'QA_%' order by id limit 40) q where m.room_id=$1",
    [room],
  );
  assert.equal(
    (await db.query("select count(*)::int n from private.question_exposures"))
      .rows[0].n,
    560,
  );
  const started = performance.now();
  const catalog = await rpc("question_catalog", [room]);
  const catalogMs = Math.round(performance.now() - started);
  const seen = new Set(
    (
      await db.query("select id from private.room_seen_question_ids($1)", [
        room,
      ])
    ).rows.map((q) => q.id),
  );
  assert(!catalog.some((q) => seen.has(q.id)));
  for (const q of catalog.slice(0, 20)) assert(!("_words" in q));
  const categories = [...new Set(catalog.map((q) => q.category))];
  const preparing = performance.now();
  await rpc("prepare_match", [room, 8, categories, null, [], "automatic"]);
  const prepareMs = Math.round(performance.now() - preparing);
  const game = (await rpc("public_room_snapshot", [room])).game;
  assert.equal(game.players.length, 13);
  assert.equal(game.planned, 8);
  const deck = (
    await db.query("select questions from private.decks where match_id=$1", [
      game.id,
    ])
  ).rows[0].questions;
  assert.equal(deck.length, 13);
  assert(!deck.some((q) => seen.has(q.id)));
  assert(
    deck.every(
      (q) =>
        !("_words" in q) && !("_answer_key" in q) && !("_question_key" in q),
    ),
  );
  const counts = { facil: 0, medio: 0, dificil: 0 };
  deck.slice(0, 8).forEach((q) => counts[q.difficulty]++);
  assert.deepEqual(counts, { facil: 4, medio: 3, dificil: 1 });
  assert(catalogMs < 8000);
  assert(prepareMs < 8000);
  console.log(
    `PASS 1,004 questions, 14 participants, 560 daily exposure rows; catalog ${catalogMs}ms, preparation ${prepareMs}ms under the 8s API budget; daily filtering, quotas and cache privacy (local SQL).`,
  );
} finally {
  await db.close();
}
