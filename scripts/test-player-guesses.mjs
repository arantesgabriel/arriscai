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
  await assert.rejects(
    send(a, "submit_guess", { text: "QA antes da pista" }),
    /Registre o palpite/,
  );
  await send(host, "select", { position: 21 });
  await send(host, "reveal");
  for (const id of [b, tv, host, outsider])
    await assert.rejects(
      send(id, "submit_guess", { text: "QA fora da vez" }),
      /Somente|organizador/,
    );
  for (const command of ["guess", "judge", "select"])
    await assert.rejects(
      send(a, command, { text: "QA", correct: true, position: 0 }),
      /Somente organizador/,
    );
  await assert.rejects(
    rpc(a, "host_private_round_snapshot", [room]),
    /Somente organizador/,
  );
  for (const text of ["", " ".repeat(3), "x".repeat(201), 42, null, {}, []])
    await assert.rejects(
      send(a, "submit_guess", { text }),
      /Registre o palpite/,
    );
  await send(host, "pause");
  await assert.rejects(
    send(a, "submit_guess", { text: "QA pausado" }),
    /Partida pausada/,
  );
  await send(host, "resume");
  const before = (await state()).game;
  const key = randomUUID();
  const payload = { text: "QA tentativa compartilhada" };
  await Promise.all([
    send(a, "submit_guess", payload, key, before.version),
    send(a, "submit_guess", payload, key, before.version),
  ]);
  let g = (await state()).game;
  assert.equal(g.version, before.version + 1);
  assert.equal(g.live_guess.id, key);
  assert.equal(g.live_guess.text, payload.text);
  assert.equal(g.live_guess.player_id, a);
  assert.equal(g.phase, "awaiting_guess");
  assert(g.players.every((p) => p.score === 0));
  assert(!("answer" in g));
  assert(!("suggested" in g.live_guess));
  assert(!("aliases" in g.live_guess));
  assert.deepEqual(
    (await rpc(tv, "public_room_snapshot", [room])).game.live_guess,
    g.live_guess,
  );
  await assert.rejects(
    send(a, "submit_guess", { text: "QA troca indevida" }),
    /Palpite já enviado/,
  );
  await assert.rejects(
    send(a, "submit_guess", { text: "QA troca indevida" }, key),
    /Chave reutilizada/,
  );
  await assert.rejects(
    send(b, "submit_guess", payload, key),
    /Chave reutilizada/,
  );
  await assert.rejects(
    send(a, "submit_guess", payload, randomUUID(), before.version),
    /Conflito de versão/,
  );
  await send(host, "judge", { correct: false });
  g = (await state()).game;
  assert.equal(g.feedback.kind, "incorrect");
  assert.equal(g.feedback.player_id, a);
  assert.equal(g.players[g.current].id, b);
  assert(g.players.every((p) => p.score === 0));
  const missedVersion = g.version;
  await send(a, "submit_guess", payload, key, before.version);
  assert.equal(
    (await state()).game.version,
    missedVersion,
    "same-key retry after a turn change remains idempotent",
  );
  await send(host, "select", { position: 0 });
  await send(host, "reveal");
  assert.equal((await state()).game.live_guess, null);
  const secret = await rpc(host, "host_private_round_snapshot", [room]);
  await send(b, "submit_guess", { text: secret.answer });
  assert.equal(
    (await state()).game.phase,
    "awaiting_guess",
    "matching answer still requires human judgment",
  );
  await send(host, "judge", { correct: true });
  g = (await state()).game;
  assert.equal(g.round_points, 21);
  assert.equal(g.players.find((p) => p.id === b).score, 21);
  await send(host, "next");
  assert.equal((await state()).history[0].winner_id, b);
  await assert.rejects(
    rpc(a, "return_to_lobby", [room, g.id]),
    /Somente organizador/,
  );
  const finished = (await state()).game.id;
  await rpc(host, "return_to_lobby", [room, finished]);
  assert.equal((await state()).game, null);
  assert.equal((await state()).history[0].winner_id, b);
  await rpc(host, "return_to_lobby", [room, finished]);
  await rpc(host, "prepare_match", [
    room,
    1,
    ["Conhecimentos gerais"],
    22,
    [],
    "automatic",
  ]);
  g = (await state()).game;
  assert(g.players.every((p) => p.score === 0));
  assert(!g.live_guess);
  assert(!g.feedback);
  assert(!g.players.some((p) => p.id === tv));
  console.log(
    "PASS player guess authorization, phases, paused state, input bounds, same-key concurrency/retry, version conflicts, pending submission lock, public echo without private comparison, human judgment, incorrect feedback, scoring and new-match reset (local SQL).",
  );
} finally {
  await db.close();
}
