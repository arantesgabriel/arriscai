import assert from "node:assert/strict";
import { testDatabase } from "./pg-test-runtime.mjs";
const db = await testDatabase();
try {
  const pool = ["facil", "medio", "dificil"].flatMap((difficulty) =>
    Array.from({ length: 40 }, (_, i) => ({
      id: `${difficulty}-${i}`,
      difficulty,
    })),
  );
  const counts = (items) =>
    Object.fromEntries(
      ["facil", "medio", "dificil"].map((d) => [
        d,
        items.filter((q) => q.difficulty === d).length,
      ]),
    );
  for (let n = 1; n <= 30; n++) {
    const {
      rows: [{ deck, quota }],
    } = await db.query(
      "select private.balanced_question_deck($1::jsonb,$2,'{}','automatic') deck, private.difficulty_quotas($2) quota",
      [JSON.stringify(pool), n],
    );
    assert.equal(deck.length, n + 5);
    assert.equal(new Set(deck.map((q) => q.id)).size, deck.length);
    assert.deepEqual(counts(deck.slice(0, n)), quota);
    assert.deepEqual(counts(deck.slice(n)), { facil: 2, medio: 2, dificil: 1 });
    assert(quota.dificil <= quota.facil && quota.dificil <= quota.medio);
  }
  const selected = ["medio-0", "dificil-0"];
  const {
    rows: [{ deck }],
  } = await db.query(
    "select private.balanced_question_deck($1::jsonb,10,$2::text[],'mixed') deck",
    [JSON.stringify(pool), selected],
  );
  assert.deepEqual(counts(deck.slice(0, 10)), {
    facil: 5,
    medio: 4,
    dificil: 1,
  });
  assert(selected.every((id) => deck.slice(0, 10).some((q) => q.id === id)));
  const {
    rows: [{ fallback }],
  } = await db.query(
    "select private.balanced_question_deck($1::jsonb,10,'{}','automatic') fallback",
    [JSON.stringify(pool.filter((q) => q.difficulty === "facil"))],
  );
  assert.equal(fallback.length, 15);
  const {
    rows: [{ manual }],
  } = await db.query(
    "select private.balanced_question_deck($1::jsonb,1,$2::text[],'manual') manual",
    [JSON.stringify(pool), selected],
  );
  assert.deepEqual(
    manual.map((q) => q.id),
    selected,
  );
  const {
    rows: [{ total, ranked }],
  } = await db.query(
    "select count(*)::int total,count(complexity_score)::int ranked from private.questions",
  );
  assert.equal(total, 504);
  assert.equal(ranked, 504);
  console.log(
    "PASS difficulty helper: quotas, reserve, uniqueness, fallback and 504 classified synthetic items",
  );
} finally {
  await db.close();
}
