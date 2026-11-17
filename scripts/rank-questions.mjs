import { readFileSync, writeFileSync } from "node:fs";

// Curadoria por item: familiaridade para público brasileiro geral e especificidade
// da informação exigida, considerando as pistas efetivamente presentes no texto.
const scores = [
  [
    10, 15, 35, 10, 45, 10, 15, 35, 20, 30, 5, 40, 10, 5, 15, 40, 20, 5, 30, 45,
    25, 50, 5, 5, 25, 30, 5, 15, 70, 5,
  ],
  [
    75, 35, 40, 10, 20, 25, 35, 55, 65, 15, 10, 45, 20, 45, 10, 25, 10, 35, 25,
    45, 20, 10, 55, 50, 70, 40, 65, 5, 40, 40,
  ],
  [
    10, 15, 40, 10, 20, 10, 40, 35, 20, 30, 10, 10, 10, 25, 10, 35, 70, 15, 35,
    15, 20, 45, 15, 75, 40, 20, 35, 15, 25, 40,
  ],
  [
    40, 25, 10, 45, 20, 30, 60, 10, 45, 35, 15, 65, 45, 50, 50, 10, 25, 15, 40,
    45, 50, 90, 40, 75, 20, 40, 60, 50, 80, 60,
  ],
  [
    25, 10, 10, 65, 30, 15, 25, 15, 30, 40, 15, 35, 25, 45, 10, 70, 45, 35, 65,
    70, 40, 60, 65, 75, 45, 80, 50, 30, 15, 10,
  ],
  [
    15, 20, 45, 30, 30, 40, 30, 10, 55, 65, 55, 35, 15, 35, 70, 45, 40, 45, 25,
    55, 80, 75, 55, 75, 40, 15, 15, 40, 20, 25,
  ],
  [
    10, 35, 70, 10, 35, 45, 70, 50, 55, 45, 35, 15, 40, 15, 25, 35, 55, 35, 25,
    25, 40, 45, 5, 35, 75, 35, 70, 60, 50, 55,
  ],
  [
    10, 15, 10, 45, 60, 20, 15, 15, 25, 20, 10, 35, 50, 40, 15, 10, 25, 30, 40,
    45, 15, 15, 10, 20, 55, 75, 10, 75, 60, 85,
  ],
];
const questions = JSON.parse(readFileSync("data/perguntas_240.json", "utf8"));
const reasons = {
  facil:
    "Reconhecimento comum; pistas diretas permitem recuperar uma informação amplamente difundida.",
  medio:
    "Exige repertório escolar ou cultural específico; a associação é menos imediata para o público geral.",
  dificil:
    "Exige detalhe técnico, nome específico ou repertório de nicho; as pistas não entregam a resposta ao público geral.",
};
for (const q of questions) {
  const category = Number(q.id.slice(1, 3)) - 1;
  const item = Number(q.id.slice(3)) - 1;
  q.complexity_score = scores[category]?.[item];
  if (!Number.isInteger(q.complexity_score))
    throw new Error(`Sem avaliação: ${q.id}`);
  q.difficulty =
    q.complexity_score < 40
      ? "facil"
      : q.complexity_score < 70
        ? "medio"
        : "dificil";
}
writeFileSync(
  "data/perguntas_240.json",
  JSON.stringify(questions, null, 2) + "\n",
);
const baseline = [...questions];
let category;
let index;
for (const line of readFileSync("data/perguntas_expansao.txt", "utf8").split(
  /\r?\n/,
)) {
  if (!line.trim() || line.startsWith("#")) continue;
  if (line.startsWith("[")) {
    category = line.slice(1, -1);
    if (!baseline.some((q) => q.category === category))
      throw new Error(`Categoria desconhecida: ${category}`);
    index = 30;
    continue;
  }
  const [score, question, answer, aliases = ""] = line.split("|");
  const prefix = baseline.find((q) => q.category === category).id.slice(0, 3);
  const complexity_score = Number(score);
  questions.push({
    id: prefix + String(++index).padStart(2, "0"),
    category,
    question,
    answer,
    aliases: aliases ? aliases.split(";") : [],
    word_count: question.trim().split(/\s+/).length,
    difficulty:
      complexity_score < 40
        ? "facil"
        : complexity_score < 70
          ? "medio"
          : "dificil",
    review_status: "provisional",
    complexity_score,
  });
}
if (
  questions.length !== 504 ||
  new Set(questions.map((q) => q.id)).size !== 504
)
  throw new Error("Esperadas 504 perguntas com IDs únicos");
for (const q of questions) {
  if (
    q.word_count > 22 ||
    q.question.includes("?") ||
    !q.answer ||
    !Number.isInteger(q.complexity_score)
  )
    throw new Error(`Pergunta inválida: ${q.id}`);
}
writeFileSync(
  "data/perguntas_504.json",
  JSON.stringify(questions, null, 2) + "\n",
);
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const insert = (q) =>
  `insert into private.questions(id,category,question,answer,aliases,review_status,difficulty,complexity_score) values (${[q.id, q.category, q.question, q.answer, JSON.stringify(q.aliases), q.review_status, q.difficulty].map(quote).join(",")},${q.complexity_score}) on conflict(id) do nothing;`;
writeFileSync("supabase/seed.sql", questions.map(insert).join("\n") + "\n");
writeFileSync(
  "supabase/migrations/202611170004_expand_catalog.sql",
  "-- 264 novas perguntas. Preserva curadoria e o status editorial provisório.\n" +
    questions.slice(baseline.length).map(insert).join("\n") +
    "\n",
);
const ranking = [...questions].sort(
  (a, b) => b.complexity_score - a.complexity_score || a.id.localeCompare(b.id),
);
const lines = [
  "# Ranking de complexidade das 504 perguntas",
  "",
  "Avaliação editorial estimada para público brasileiro geral adulto, em 17/11/2026. Não representa taxa de acerto medida nem revisão factual. Escala ordinal: 0–39 fácil, 40–69 média, 70–100 difícil. Considera familiaridade da resposta, especificidade do conhecimento e pistas do enunciado; comprimento e posição no arquivo não determinam dificuldade. Empates têm a mesma complexidade estimada; IDs apenas ordenam a apresentação.",
  "",
  "Escopo: catálogo versionado. Perguntas próprias ou alterações exclusivas do banco remoto não foram consultadas.",
  "",
  "| Categoria | Fáceis | Médias | Difíceis |",
  "|---|---:|---:|---:|",
];
for (const category of new Set(questions.map((q) => q.category))) {
  const qs = questions.filter((q) => q.category === category);
  lines.push(
    `| ${category} | ${["facil", "medio", "dificil"].map((d) => qs.filter((q) => q.difficulty === d).length).join(" | ")} |`,
  );
}
lines.push(
  "",
  "A distribuição da partida visa 50% fáceis, 35% médias e 15% difíceis. Arredondamento por maiores restos, com desempate favorecendo fácil e depois média. Rodadas e reserva são balanceadas separadamente e embaralhadas. Faltas são compensadas por fáceis e depois médias antes de difíceis. Os filtros podem impedir a proporção ideal. Partidas aceitam de 1 a 8 rodadas e a seleção manual está temporariamente desativada.",
  "",
  "| Posição | ID | Categoria | Nota | Nível | Pergunta | Resposta | Avaliação |",
  "|---:|---|---|---:|---|---|---|---|",
);
ranking.forEach((q, i) =>
  lines.push(
    `| ${i + 1} | ${q.id} | ${q.category} | ${q.complexity_score} | ${q.difficulty} | ${q.question} | ${q.answer} | ${reasons[q.difficulty]} Referência avaliada: ${q.answer}. |`,
  ),
);
writeFileSync("docs/RANKING_DIFICULDADE.md", lines.join("\n") + "\n");
const values = baseline
  .map(
    (q) =>
      `(${quote(q.id)},${quote(q.difficulty)},${q.complexity_score},${quote(q.question)},${quote(q.answer)})`,
  )
  .join(",\n");
writeFileSync(
  "supabase/migrations/202611170002_question_difficulty.sql",
  `-- Não promove aprovação editorial nem altera snapshots de partidas existentes.\nalter table private.questions add column difficulty text not null default 'medio' check(difficulty in ('facil','medio','dificil'));\nalter table private.questions add column complexity_score integer check(complexity_score between 0 and 100);\n-- Preserva curadoria remota cujo enunciado ou resposta diverge do catálogo avaliado.\nupdate private.questions q set difficulty=v.difficulty, complexity_score=v.score from (values\n${values}\n) v(id,difficulty,score,question,answer) where q.id=v.id and q.owner_id is null and q.question=v.question and q.answer=v.answer;\n`,
);
