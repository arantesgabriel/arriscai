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
  const reveal = async (position) => {
    await send(host, "select", { position });
    await send(host, "reveal");
    return (await state()).game;
  };
  const expire = () =>
    db.query(
      "update public.rooms set game=jsonb_set(game,'{guess_deadline}',to_jsonb((now()-interval '1 second')::text)) where id=$1",
      [room],
    );
  let g = await reveal(0);
  assert(Math.abs(Date.parse(g.guess_deadline) - Date.now() - 60000) < 2000);
  const deadline = g.guess_deadline;
  assert.equal(
    (await state()).game.guess_deadline,
    deadline,
    "refresh never restarts the minute",
  );
  await db.query(
    "update public.rooms set game=jsonb_set(game,'{guess_deadline}',to_jsonb((now()+interval '12 seconds')::text)) where id=$1",
    [room],
  );
  await send(host, "pause");
  g = (await state()).game;
  assert(!g.guess_deadline);
  assert(g.guess_remaining_ms > 10000 && g.guess_remaining_ms <= 12000);
  const remaining = g.guess_remaining_ms;
  await send(host, "adjust", { rounds: 1 }).catch(() => {});
  assert.equal((await state()).game.guess_remaining_ms, remaining);
  await send(host, "resume");
  g = (await state()).game;
  assert(
    Math.abs(Date.parse(g.guess_deadline) - Date.now() - remaining) < 1000,
  );
  await expire();
  const snapshots = await Promise.all([state(), state(), state()]);
  for (const s of snapshots) {
    assert.equal(s.game.phase, "awaiting_position");
    assert.equal(s.game.current, 1);
    assert.equal(s.game.version, g.version + 1);
    assert.equal(s.game.timed_out.nickname, "Ana");
    assert(!s.game.guess_deadline);
    assert(s.game.players.every((p) => p.score === 0));
    assert(s.server_now);
  }
  g = await reveal(1);
  assert(!g.timed_out);
  await expire();
  // Send directly, without first taking a snapshot that would settle expiry.
  await rpc(b, "game_command", [
    room,
    g.id,
    g.version,
    randomUUID(),
    "submit_guess",
    { text: "late" },
  ]);
  g = (await state()).game;
  assert.equal(g.phase, "awaiting_position");
  assert.equal(g.current, 0);
  assert(!g.live_guess);
  await reveal(2);
  await send(a, "submit_guess", { text: "before deadline" });
  g = (await state()).game;
  assert(!g.guess_deadline, "a submitted guess stops the clock");
  await expire();
  assert.equal(
    (await state()).game.phase,
    "awaiting_guess",
    "judgment has no deadline",
  );
  await send(host, "judge", { correct: false });
  await reveal(3);
  await send(host, "undo");
  assert(!(await state()).game.guess_deadline);
  // Simulate the final revealed word and ensure timeout closes the round.
  g = await reveal(3);
  await db.query(
    "update public.rooms set game=jsonb_set(game,'{words}',(select jsonb_agg(coalesce(nullif(w,'null'::jsonb),'\"revealed\"'::jsonb)) from jsonb_array_elements(game->'words') w)) where id=$1",
    [room],
  );
  await expire();
  g = (await state()).game;
  assert.equal(g.phase, "result");
  assert.equal(g.result, null);
  assert.equal(g.round_points, 0);
  assert(g.answer);
  assert(!g.words.includes(null));
  await send(host, "cancel");
  await rpc(host, "prepare_match", [
    room,
    1,
    ["Conhecimentos gerais"],
    22,
    [],
    "automatic",
  ]);
  await reveal(0);
  await assert.rejects(send(a, "skip_question"), /Somente organizador/);
  await send(host, "skip_question");
  g = (await state()).game;
  assert.equal(g.phase, "result");
  assert.equal(g.result, null);
  assert.equal(g.round_points, 0);
  assert(g.players.every((p) => p.score === 0));
  assert(!g.guess_deadline);
  assert(!g.words.includes(null));
  assert(g.answer);
  await assert.rejects(send(host, "skip_question"), /Rodada já encerrada/);
  await assert.rejects(
    rpc(outsider, "public_room_snapshot", [room]),
    /expirou/,
  );
  console.log(
    "PASS server minute, refresh persistence, pause/resume, concurrent expiry, late guess, stopped judgment clock, undo, final-word expiry, privacy (local SQL).",
  );
} finally {
  await db.close();
}
