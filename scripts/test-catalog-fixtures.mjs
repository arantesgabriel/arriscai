// Synthetic test-only content. Never import into a hosted catalogue.
export const testCategories = [
  "Conhecimentos gerais",
  "Filmes e séries",
  "Música",
  "Esportes",
  "Geografia",
  "História",
  "Ciência e tecnologia",
  "Cultura pop",
];

export function testCatalog({ baseline = false } = {}) {
  return testCategories.flatMap((category, c) =>
    Array.from({ length: baseline ? 30 : 63 }, (_, index) => {
      const item = index + 1;
      const number = `${String(c + 1).padStart(2, "0")}${String(item).padStart(2, "0")}`;
      const size =
        item <= 6 ? 22 : item <= 12 ? 9 : item <= 18 ? 8 : item <= 24 ? 6 : 11;
      const words = [
        "QA",
        `item${number}`,
        "palavra-fictícia-extremamente-comprida",
        ...Array.from({ length: size - 3 }, (_, i) => `pista${i + 4}`),
      ];
      const difficulty = ["facil", "medio", "dificil"][index % 3];
      return {
        id: `QA_${number}`,
        category,
        question: words.join(" "),
        answer: `gabarito-${number}`,
        aliases: [`alias-${number}`],
        word_count: size,
        difficulty,
        complexity_score: { facil: 15, medio: 45, dificil: 75 }[difficulty],
        review_status: "provisional",
      };
    }),
  );
}

export async function insertTestCatalog(db, options) {
  for (const q of testCatalog(options)) {
    await db.query(
      `insert into private.questions(id,category,question,answer,aliases,review_status,difficulty,complexity_score)
       values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(id) do nothing`,
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
  }
}
