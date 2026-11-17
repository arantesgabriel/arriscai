import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { testDatabase } from "./pg-test-runtime.mjs";

const host = randomUUID();
const player = randomUUID();
const room = randomUUID();
const wonMatch = randomUUID();
const tiedMatch = randomUUID();
let seeded = false;

const db = await testDatabase({
  afterMigration: async (file, database) => {
    if (file.endsWith("202611170003_balanced_decks.sql")) {
      // Simula um banco já povoado com as 240 questões e curadoria local.
      const baseline = JSON.parse(
        readFileSync("data/perguntas_240.json", "utf8"),
      );
      for (const q of baseline)
        await database.query(
          "insert into private.questions(id,category,question,answer,aliases,review_status,difficulty,complexity_score) values ($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            q.id,
            q.category,
            q.question,
            q.answer,
            JSON.stringify(q.aliases),
            q.review_status,
            q.difficulty,
            q.complexity_score,
          ],
        );
      await database.exec(
        "update private.questions set question='Texto já revisado no banco',review_status='approved' where id='Q0101'",
      );
    }
    if (file.endsWith("202611170004_expand_catalog.sql")) {
      const {
        rows: [{ total }],
      } = await database.query(
        "select count(*)::int total from private.questions",
      );
      assert.equal(
        total,
        504,
        "migração deve expandir banco existente sem depender de rodar seed novamente",
      );
    }
    if (!file.endsWith("202611130001_game.sql")) return;
    await database.query("insert into auth.users values ($1), ($2)", [
      host,
      player,
    ]);
    await database.query(
      "insert into public.rooms(id, code, host_id) values ($1, 'UPGRADE', $2)",
      [room, host],
    );
    await database.query(
      "insert into public.room_members(room_id, user_id, nickname) values ($1, $2, 'Ana'), ($1, $3, 'Bia')",
      [room, host, player],
    );
    await database.query(
      "insert into public.room_match_history(id, room_id, scores) values ($1, $2, $3), ($4, $2, $5)",
      [
        wonMatch,
        room,
        JSON.stringify([
          { id: host, nickname: "Ana", score: 19 },
          { id: player, nickname: "Bia", score: 22 },
        ]),
        tiedMatch,
        JSON.stringify([
          { id: host, nickname: "Ana", score: 22 },
          { id: player, nickname: "Bia", score: 22 },
        ]),
      ],
    );
    await database.query(
      `insert into private.actions(match_id, key, actor, command, payload, version, created_at)
       values ($1, $2, $3, 'select', '{}', 1, '2026-11-01T12:00:00Z'),
              ($1, $4, $3, 'next', '{}', 2, '2026-11-01T12:01:00Z'),
              ($1, $5, $3, 'next', '{}', 3, '2026-11-01T12:02:00Z'),
              ($6, $7, $3, 'next', '{}', 1, '2026-11-02T12:00:00Z')`,
      [
        wonMatch,
        randomUUID(),
        host,
        randomUUID(),
        randomUUID(),
        tiedMatch,
        randomUUID(),
      ],
    );
    seeded = true;
  },
});

assert(seeded, "legacy fixture must be inserted between the two migrations");
const { rows } = await db.query(
  "select id, winner_id, winner_nickname, host_id, host_nickname, total_rounds from public.room_match_history order by id",
);
const winner = rows.find((row) => row.id === wonMatch);
const tie = rows.find((row) => row.id === tiedMatch);
assert.equal(winner.winner_id, player);
assert.equal(winner.winner_nickname, "Bia");
assert.equal(winner.host_id, host);
assert.equal(winner.host_nickname, "Ana");
assert.equal(winner.total_rounds, 2);
assert.equal(tie.winner_id, null);
assert.equal(tie.winner_nickname, null);
assert.equal(tie.total_rounds, 1);
const {
  rows: [curated],
} = await db.query(
  "select question,review_status from private.questions where id='Q0101'",
);
assert.equal(curated.question, "Texto já revisado no banco");
assert.equal(curated.review_status, "approved");
await db.close();
console.log(
  "PASS incremental history migration backfills winners, organizer and rounds; preserves ties",
);
