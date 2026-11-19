import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./pg-test-runtime.mjs";

const db = await testDatabase();
const [host, a, b, tv, outsider] = Array.from({ length: 5 }, () =>
  randomUUID(),
);
async function rpc(id, name, args = []) {
  return db.transaction(async (tx) => {
    await tx.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
      [id, JSON.stringify({ sub: id, is_anonymous: true })],
    );
    await tx.exec("set local role authenticated");
    return (
      await tx.query(
        `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) value`,
        args,
      )
    ).rows[0]?.value;
  });
}
try {
  for (const id of [host, a, b, tv, outsider])
    await db.query("insert into auth.users values($1)", [id]);
  await db.exec("update private.settings set allow_provisional=true");
  const room = await rpc(host, "create_room", ["Host"]);
  const state = () => rpc(host, "public_room_snapshot", [room]);
  const code = (await state()).code;
  await rpc(a, "join_room", [code, "Ana", false]);
  await rpc(b, "join_room", [code, "Bruno", false]);
  await rpc(tv, "join_room", [code, "Telão", true]);
  await rpc(host, "prepare_match", [
    room,
    1,
    ["Conhecimentos gerais"],
    22,
    [],
    "automatic",
  ]);
  async function send(id, command, payload = {}, key = randomUUID(), version) {
    const g = (await state()).game;
    return rpc(id, "game_command", [
      room,
      g.id,
      version ?? g.version,
      key,
      command,
      payload,
    ]);
  }
  const first = (
    await db.query(
      "select questions->0 q from private.decks where room_id=$1",
      [room],
    )
  ).rows[0].q;
  const semanticPool = [
    {
      id: "one",
      question: "alpha bravo charlie delta",
      answer: "one",
      difficulty: "facil",
    },
    {
      id: "two",
      question: "alpha bravo charlie delta",
      answer: "two",
      difficulty: "facil",
    },
    {
      id: "three",
      question: "unrelated gamma zeta omega",
      answer: "three",
      difficulty: "medio",
    },
  ];
  const semanticDeck = (
    await db.query(
      "select private.balanced_question_deck($1::jsonb,3,'{}','automatic') value",
      [JSON.stringify(semanticPool)],
    )
  ).rows[0].value;
  assert.equal(
    semanticDeck.length,
    2,
    "similar questions cannot enter the same planned/reserve deck",
  );
  const seen = async (targetRoom, id, question, answer, topic = null) =>
    (
      await db.query(
        "select private.seen_question_today($1,$2,$3,$4,$5) value",
        [targetRoom, id, question, answer, topic],
      )
    ).rows[0].value;
  assert(await seen(room, first.id, "different text", "different answer"));
  assert(await seen(room, "new-id", "different text", first.answer));
  assert(await seen(room, "new-id", first.question, "different answer"));
  assert.equal(
    await seen(
      room,
      "new-id",
      "astronomia galaxias planetas orbitas",
      "unseen-answer",
    ),
    false,
  );
  await db.query(
    "update private.question_exposures set topic_key='same-topic' where question_id=$1",
    [first.id],
  );
  assert(
    await seen(
      room,
      "new-id",
      "different text",
      "different answer",
      "same-topic",
    ),
  );
  const similar = (
    await db.query(
      "select private.similar_question('Qual planeta possui grandes anéis visíveis no Sistema Solar','Qual planeta tem grandes anéis visíveis no Sistema Solar') value",
    )
  ).rows[0].value;
  assert.equal(similar, true);
  const room2 = await rpc(outsider, "create_room", ["Outro Host"]);
  const code2 = (await rpc(outsider, "public_room_snapshot", [room2])).code;
  await rpc(a, "join_room", [code2, "Ana", false]);
  assert(await seen(room2, first.id, first.question, first.answer));
  await send(host, "cancel");
  const catalog = await rpc(host, "question_catalog", [room]);
  assert(!catalog.some((q) => q.id === first.id));
  await rpc(host, "prepare_match", [
    room,
    1,
    ["Conhecimentos gerais"],
    22,
    [],
    "automatic",
  ]);
  const next = (
    await db.query(
      "select questions->0 q from private.decks where match_id=$1",
      [(await state()).game.id],
    )
  ).rows[0].q;
  assert.notEqual(next.id, first.id);
  await db.query("update private.question_exposures set play_day=play_day-1");
  assert.equal(await seen(room, first.id, first.question, first.answer), false);
  await assert.rejects(
    rpc(a, "return_to_lobby", [room, (await state()).game.id]),
    /Somente organizador/,
  );
  await assert.rejects(
    rpc(host, "return_to_lobby", [room, (await state()).game.id]),
    /Conclua a partida/,
  );
  console.log(
    "PASS daily identity, answer, topic and paraphrase exclusion; cross-room participant history; next-day reset; catalog filtering; subsequent preparation and lobby guards (local SQL).",
  );
} finally {
  await db.close();
}
