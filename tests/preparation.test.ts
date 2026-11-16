import { describe, expect, it } from "vitest";
import { readPreparation } from "../src/lib/preparation";
const preview = {
  hostId: "host",
  rounds: 5,
  words: 22,
  categories: ["Música"],
  categoryOptions: ["Música", "História"],
  mode: "manual",
  selectedCount: 2,
  availableCount: 20,
};
describe("prévia pública de preparação", () => {
  it("restringe o conteúdo a opções públicas e contagens", () => {
    expect(
      readPreparation(
        {
          ...preview,
          question: "privada",
          answer: "privada",
          selected: ["id-privado"],
        },
        "host",
      ),
    ).toEqual(preview);
  });
  it("ignora configuração de outro organizador e valores inválidos", () => {
    expect(readPreparation(preview, "outro-host")).toBeNull();
    for (const values of [
      { rounds: 0 },
      { rounds: 31 },
      { words: 23 },
      { mode: "inventado" },
      { mode: { toString: "invalid" } },
      { categories: [5] },
      { selectedCount: -1 },
    ])
      expect(readPreparation({ ...preview, ...values }, "host")).toBeNull();
  });
});
