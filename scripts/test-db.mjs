import { testDatabase } from "./pg-test-runtime.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const db = await testDatabase();
const host = randomUUID(),
  player = randomUUID(),
  player2 = randomUUID(),
  screen = randomUUID(),
  outsider = randomUUID();
for (const id of [host, player, player2, screen, outsider])
  await db.query("insert into auth.users values($1)", [id]);
await db.exec(`update private.settings set allow_provisional=true`);

async function as(id, anonymous = true) {
  await db.exec("reset role");
  await db.query(
    `select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)`,
    [id, JSON.stringify({ sub: id, is_anonymous: anonymous })],
  );
  await db.exec("set role authenticated");
}
async function call(name, args = []) {
  const result = await db.query(
    `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as value`,
    args,
  );
  return result.rows[0]?.value;
}
const checks = [];
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
async function denied(fn) {
  await assert.rejects(fn);
}
await as(host);
const room = await call("create_room", ["Ana"]);
const snapshot = () => call("public_room_snapshot", [room]);
const code = (await snapshot()).code;
await check(
  "room codes, anonymous authenticated identity and lobby",
  async () => {
    assert.equal((await snapshot()).host_id, host);
    assert.match(code, /^[A-F0-9]{8}$/);
  },
);
for (const [id, name] of [
  [player, "Bia"],
  [player2, "Caio"],
]) {
  await as(id);
  await call("join_room", [code, name, false]);
}
await check("outsider cannot read room or tables", async () => {
  await as(outsider);
  await denied(() => snapshot());
  assert.equal((await db.query("select * from public.rooms")).rows.length, 0);
  assert.equal(
    (await db.query("select * from public.room_members")).rows.length,
    0,
  );
  await denied(() => db.query("select * from private.questions"));
  await denied(() =>
    db.query("update public.rooms set host_id=$1", [outsider]),
  );
});
await check(
  "guest cannot author, including authenticated Postgres role",
  async () => {
    await as(host);
    await denied(() =>
      call("save_question", [room, "Qual planeta", "Marte", "Teste", []]),
    );
  },
);
await check("permanent author can create and edit own questions", async () => {
  await as(host, false);
  const id = await call("save_question", [
    room,
    "Qual planeta???",
    "Marte",
    "Teste",
    [],
  ]);
  await call("save_question", [
    room,
    "Qual planeta vermelho?",
    "Marte",
    "Teste",
    ["marte"],
    id,
  ]);
  const qs = await call("question_catalog", [room]);
  assert.equal(qs.find((q) => q.id === id).question, "Qual planeta vermelho");
  await as(player, false);
  await denied(() =>
    call("save_question", [room, "Invasão", "Não", "Teste", [], id]),
  );
});
await check(
  "22 words + one category + 12 rounds rejects insufficient without duplicates",
  async () => {
    await as(host);
    await denied(() =>
      call("prepare_match", [
        room,
        12,
        ["Conhecimentos gerais"],
        22,
        [],
        "automatic",
      ]),
    );
  },
);
await as(host);
await call("prepare_match", [
  room,
  2,
  ["Conhecimentos gerais"],
  22,
  [],
  "automatic",
]);
let game = (await snapshot()).game;
const command = async (
  name,
  payload = {},
  key = randomUUID(),
  version = undefined,
) => {
  const g = (await snapshot()).game;
  await call("game_command", [
    room,
    g.id,
    version ?? g.version,
    key,
    name,
    payload,
  ]);
  return (await snapshot()).game;
};
await check(
  "public snapshot has no question IDs, answers, aliases or hidden words",
  async () => {
    const s = await snapshot();
    assert.equal(s.game.words.length, 22);
    assert(s.game.words.every((w) => w === null));
    assert(!JSON.stringify(s).includes("Q010"));
    assert(!JSON.stringify(s).includes("answer"));
    assert(!JSON.stringify(s).includes("aliases"));
  },
);
await check(
  "late spectator and player cannot mutate, read host RPC or catalog",
  async () => {
    await as(screen);
    await call("join_room", [code, "Telão", true]);
    assert(
      (await snapshot()).members.find((m) => m.user_id === screen).spectator,
    );
    for (const id of [screen, player]) {
      await as(id);
      await denied(() => call("host_private_round_snapshot", [room]));
      await denied(() => call("question_catalog", [room]));
      await denied(() => command("select", { position: 5 }));
    }
  },
);
await as(host);
await check(
  "host cannot change organizer or edit question during play",
  async () => {
    await denied(() => call("choose_host", [room, player]));
    await as(host, false);
    await denied(() =>
      call("save_question", [room, "Nova pergunta", "Nada", "Teste", []]),
    );
    await as(host);
  },
);
await check(
  "reveal requires selection; selection does not reveal",
  async () => {
    await denied(() => command("reveal"));
    game = await command("select", { position: 5 });
    assert.equal(game.phase, "pending_confirmation");
    assert(game.words.every((w) => w === null));
    game = await command("cancel_selection");
    assert.equal(game.selected, null);
    await command("select", { position: 5 });
    game = await command("reveal");
    assert.equal(game.phase, "awaiting_guess");
    assert.equal(game.words.filter(Boolean).length, 1);
    assert(game.words[5]);
  },
);
await check("undo before guess removes last reveal", async () => {
  game = await command("undo");
  assert(game.words.every((w) => w === null));
  assert.equal(game.phase, "awaiting_position");
  await command("select", { position: 5 });
  await command("reveal");
});
await check(
  "guess stays private; human can correct suggestion; duplicate command scores once",
  async () => {
    const sec = await call("host_private_round_snapshot", [room]);
    await command("guess", { text: sec.answer });
    assert((await call("host_private_round_snapshot", [room])).suggested);
    await denied(() => command("undo"));
    const key = randomUUID(),
      v = (await snapshot()).game.version;
    game = await command("judge", { correct: true }, key, v);
    const total = game.players.reduce((n, p) => n + p.score, 0);
    assert.equal(total, 22);
    assert.equal(game.phase, "result");
    assert.equal(game.round_points, 22);
    assert.equal(game.answer, sec.answer);
    assert.equal(game.aliases, undefined);
    await command("judge", { correct: true }, key, v);
    assert.equal(
      (await snapshot()).game.players.reduce((n, p) => n + p.score, 0),
      22,
    );
    await denied(() => command("judge", { correct: false }, key, v));
  },
);
await check("stale version loses; phase cannot double-award", async () => {
  await denied(() => command("next", {}, randomUUID(), 1));
  await denied(() => command("judge", { correct: true }));
});
await check("round advances manually and rotates first player", async () => {
  game = await command("next");
  assert.equal(game.round, 1);
  assert.equal(game.current, 1);
  assert.equal(game.answer, undefined);
  assert.equal(game.round_points, 0);
  assert(game.words.every((w) => w === null));
});
await check(
  "pause blocks mutations; resume restores; invalid indices rejected",
  async () => {
    await command("pause");
    await denied(() => command("select", { position: 0 }));
    await command("resume");
    await denied(() => command("select", { position: -1 }));
    await denied(() => command("select", { position: 22 }));
    await denied(() => command("select", {}));
  },
);
await check("round adjustment uses prepared deck only", async () => {
  await denied(() => command("adjust", { rounds: 99 }));
  game = await command("adjust", { rounds: 2 });
  assert.equal(game.planned, 2);
});
await check("wrong/pass leaves words revealed and rotates turn", async () => {
  await command("select", { position: 0 });
  await command("reveal");
  await command("guess", { text: "incorreto" });
  game = await command("judge", { correct: false });
  assert.equal(game.current, 0);
  assert.equal(game.words.filter(Boolean).length, 1);
  await command("select", { position: 1 });
  await command("reveal");
  game = await command("pass");
  assert.equal(game.current, 1);
  assert.equal(game.words.filter(Boolean).length, 2);
});
await check(
  "last incorrect answer ends without points; unique leader wins on manual advance",
  async () => {
    for (let i = 2; i < 22; i++) {
      await command("select", { position: i });
      await command("reveal");
      game = await command("pass");
    }
    assert.equal(game.phase, "result");
    assert.equal(game.result, null);
    assert.equal(game.round_points, 0);
    assert(typeof game.answer === "string" && game.answer.length > 0);
    game = await command("next");
    assert.equal(game.status, "completed");
    const hist = (await snapshot()).history;
    assert.equal(hist.length, 1);
    assert.equal(hist[0].total_rounds, 2);
    assert.equal(hist[0].host_nickname, "Ana");
    assert.equal(hist[0].winner_nickname, "Bia");
  },
);
await check(
  "new host and match reset all scores, old host becomes player",
  async () => {
    await call("choose_host", [room, player]);
    await as(player);
    await call("prepare_match", [
      room,
      1,
      ["Conhecimentos gerais"],
      22,
      [],
      "automatic",
    ]);
    game = (await snapshot()).game;
    assert.equal(game.host, player);
    assert(game.players.every((p) => p.score === 0));
    assert(game.players.some((p) => p.id === host));
  },
);
await check(
  "disconnected host automatically pauses and can resume",
  async () => {
    await db.exec("reset role");
    await db.query(
      `update public.room_members set last_seen=now()-interval '60 seconds' where room_id=$1 and user_id=$2`,
      [room, player],
    );
    await as(host);
    await call("heartbeat", [room]);
    assert((await snapshot()).game.paused);
    await as(player);
    await call("heartbeat", [room]);
    await command("resume");
  },
);
await check(
  "skip only disconnected current player, preserves circular order",
  async () => {
    await denied(() => command("skip"));
    const g = (await snapshot()).game;
    await db.exec("reset role");
    await db.query(
      `update public.room_members set last_seen=now()-interval '60 seconds' where room_id=$1 and user_id=$2`,
      [room, g.players[g.current].id],
    );
    await as(player);
    game = await command("skip");
    assert.equal(game.current, (g.current + 1) % g.players.length);
  },
);
await check(
  "tie consumes an unrepeated reserve and keeps rotation",
  async () => {
    for (let i = 0; i < 22; i++) {
      await command("select", { position: i });
      await command("reveal");
      await command("pass");
    }
    game = await command("next");
    assert.equal(game.status, "active");
    assert.equal(game.round, 1);
    assert.equal(game.current, 1 % game.players.length);
  },
);
await check(
  "private Broadcast topic membership and Presence-only client writes",
  async () => {
    await db.query(`select set_config('realtime.topic',$1,false)`, [
      "room:" + room,
    ]);
    await db.query(
      `insert into realtime.messages(extension) values('presence')`,
    );
    await denied(() =>
      db.query(`insert into realtime.messages(extension) values('broadcast')`),
    );
    await as(outsider);
    await denied(() =>
      db.query(`insert into realtime.messages(extension) values('presence')`),
    );
    await db.exec("reset role");
    const events = (await db.query("select * from realtime.sent")).rows;
    assert(events.length > 0);
    for (const e of events) {
      assert.equal(e.private, true);
      assert.deepEqual(Object.keys(e.payload), ["room_id"]);
    }
  },
);
await check("public launch blocks provisional catalog by default", async () => {
  await as(player);
  await command("cancel");
  await db.exec(
    `reset role;update private.settings set allow_provisional=false`,
  );
  await as(player);
  assert.equal((await call("question_catalog", [room])).length, 0);
});
await check(
  "fourth reveal scores 19, final reveal scores 1 in real SQL",
  async () => {
    await db.exec(
      "reset role; update private.settings set allow_provisional=true; delete from private.rate_limits",
    );
    await as(host);
    const r = await call("create_room", ["Host pontuação"]);
    const s = () => call("public_room_snapshot", [r]);
    const c = (await s()).code;
    await as(player);
    await call("join_room", [c, "Jogador pontuação", false]);
    await as(host);
    await call("prepare_match", [
      r,
      2,
      ["Conhecimentos gerais"],
      22,
      [],
      "automatic",
    ]);
    const send = async (cmd, payload = {}) => {
      const g = (await s()).game;
      await call("game_command", [
        r,
        g.id,
        g.version,
        randomUUID(),
        cmd,
        payload,
      ]);
      return (await s()).game;
    };
    for (const [round, reveals, score] of [
      [0, 4, 19],
      [1, 22, 20],
    ]) {
      for (let i = 0; i < reveals; i++) {
        await send("select", { position: i });
        await send("reveal");
        if (i < reveals - 1) await send("pass");
      }
      const sec = await call("host_private_round_snapshot", [r]);
      await send("guess", { text: sec.answer });
      await denied(() => send("judge", {}));
      const g = await send("judge", { correct: true });
      assert.equal(g.players[0].score, score);
      assert.equal(g.round, round);
      await send("next");
    }
  },
);
await check(
  "exhausted tie blocks victory, accepts only eligible pre-round custom reserve",
  async () => {
    await db.exec("reset role; delete from private.rate_limits");
    await as(player);
    // Original room is cancelled by the preceding public-catalog check.
    await call("prepare_match", [
      room,
      1,
      ["Conhecimentos gerais"],
      22,
      ["Q0101"],
      "manual",
    ]);
    for (let i = 0; i < 22; i++) {
      await command("select", { position: i });
      await command("reveal");
      await command("pass");
    }
    await denied(() => command("next"));
    await denied(() =>
      command("reserve_custom", {
        question: "Qual planeta vermelho",
        answer: "Marte",
      }),
    );
    await as(player, false);
    await command("reserve_custom", {
      question: "Quanto vale dois mais dois???",
      answer: "Quatro",
    });
    const g = await command("next");
    assert.equal(g.round, 1);
    assert.equal(g.words.length, 5);
    assert(g.words.every((w) => w === null));
    await denied(() =>
      command("reserve_custom", {
        question: "Qualquer pergunta",
        answer: "Nada",
      }),
    );
  },
);
await check(
  "cancel converts late spectator into eligible player while preserving display_only screen",
  async () => {
    const lateJoiner = randomUUID();
    await db.exec("reset role");
    await db.query("insert into auth.users values($1)", [lateJoiner]);
    await as(lateJoiner);
    await call("join_room", [code, "Davi Tardio", false]);
    let snap = await snapshot();
    assert.equal(
      snap.members.find((m) => m.user_id === lateJoiner)?.spectator,
      true,
    );
    assert.equal(
      snap.members.find((m) => m.user_id === screen)?.spectator,
      true,
    );
    await as(player);
    await command("cancel");
    snap = await snapshot();
    assert.equal(
      snap.members.find((m) => m.user_id === lateJoiner)?.spectator,
      false,
    );
    assert.equal(
      snap.members.find((m) => m.user_id === screen)?.spectator,
      true,
    );
    assert.equal(
      snap.members.find((m) => m.user_id === screen)?.display_only,
      true,
    );
  },
);
await check(
  "host_question_preview only works for host outside active match and roulette syncs",
  async () => {
    await db.exec(
      "reset role; update private.settings set allow_provisional=true",
    );
    await as(player);
    const prev = await call("host_question_preview", [room, "Q0101"]);
    assert.equal(prev.answer, "Marte");
    await as(host);
    await denied(() => call("host_question_preview", [room, "Q0101"]));
    await as(player);
    await call("choose_host", [room, null]);
    const snap = await snapshot();
    assert.equal(snap.roulette?.mode, "roulette");
    assert(snap.roulette?.winner_id);
  },
);
await check(
  "nine-word Tour de France result exposes 8 round points and completed score",
  async () => {
    await db.exec("reset role; delete from private.rate_limits");
    await db.query(
      `insert into private.questions(id, category, question, answer, review_status)
       values ('QA_NINE_WORDS', 'QA Pontuação', 'Qual esporte é tradicionalmente associado ao Tour de France', 'Ciclismo', 'approved')
       on conflict(id) do nothing`,
    );
    await as(host);
    const qaRoom = await call("create_room", ["Host oito pontos"]);
    const qaSnapshot = () => call("public_room_snapshot", [qaRoom]);
    const qaCode = (await qaSnapshot()).code;
    await as(player);
    await call("join_room", [qaCode, "Jogador oito pontos", false]);
    await as(host);
    await call("prepare_match", [
      qaRoom,
      1,
      ["QA Pontuação"],
      9,
      ["QA_NINE_WORDS"],
      "manual",
    ]);
    const send = async (name, payload = {}) => {
      const game = (await qaSnapshot()).game;
      await call("game_command", [
        qaRoom,
        game.id,
        game.version,
        randomUUID(),
        name,
        payload,
      ]);
      return (await qaSnapshot()).game;
    };
    for (const position of [0, 1]) {
      await send("select", { position });
      await send("reveal");
      if (position === 0) await send("pass");
    }
    const secret = await call("host_private_round_snapshot", [qaRoom]);
    await send("guess", { text: secret.answer });
    const result = await send("judge", { correct: true });
    assert.equal(result.phase, "result");
    assert.equal(result.round_points, 8);
    assert.equal(result.players[0].score, 8);
    assert.equal((await qaSnapshot()).game.round_points, 8);
    const completed = await send("next");
    assert.equal(completed.status, "completed");
    assert.equal(completed.players[0].score, 8);
  },
);
mkdirSync("docs", { recursive: true });
writeFileSync(
  "docs/db-test-results.json",
  JSON.stringify(
    {
      runtime:
        "PGlite PostgreSQL; auth and Realtime schemas mocked, real SQL grants/RLS/RPC executed",
      checks,
      passed: checks.length,
      limitations: [
        "No live Supabase Auth or WebSocket transport",
        "Single embedded connection: no parallel row-lock contention measurement",
      ],
    },
    null,
    2,
  ) + "\n",
);
await db.close();
console.log(`${checks.length} database checks passed.`);
