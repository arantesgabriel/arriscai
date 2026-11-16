import { describe, expect, it } from "vitest";
import {
  firstPlayer,
  humanError,
  normalize,
  points,
  questionText,
  suggestsCorrect,
  tokenize,
} from "../src/lib/game";
import seed from "../data/perguntas_240.json";
describe("Regras de conteúdo e pontuação", () => {
  it.each([
    [22, 1, 22],
    [22, 4, 19],
    [22, 22, 1],
    [1, 1, 1],
  ])("N=%i R=%i vale %i", (n, r, score) => expect(points(n, r)).toBe(score));
  it("posição 6 na primeira jogada não muda pontos", () =>
    expect(points(22, 1)).toBe(22));
  it.each(["Qual é a capital", "Qual é a capital?", "Qual é a capital???"])(
    "normaliza interrogação: %s",
    (q) => {
      expect(questionText(q)).toBe("Qual é a capital?");
      expect(tokenize(q)).toHaveLength(4);
    },
  );
  it("preserva hífens, acentos, palavras longas e não cria tile de sinal", () =>
    expect(tokenize("A aranha-caranguejeira é sul-americana ?")).toEqual([
      "A",
      "aranha-caranguejeira",
      "é",
      "sul-americana",
    ]));
  it("normaliza comparação sem fuzzy inseguro", () => {
    expect(normalize("  PACÍFICO! ")).toBe("pacifico");
    expect(suggestsCorrect("Pacífico!", "Oceano Pacífico", ["Pacífico"])).toBe(
      true,
    );
    expect(suggestsCorrect("Mar", "Marte", [])).toBe(false);
  });
  it("gira primeiro jogador independentemente do fim da rodada", () =>
    expect(
      Array.from({ length: 5 }, (_, i) => firstPlayer(i, ["a", "b", "c"])),
    ).toEqual(["a", "b", "c", "a", "b"]));
  it("rejeita fronteiras inválidas", () => {
    expect(() => points(22, 0)).toThrow();
    expect(() => points(23, 1)).toThrow();
    expect(() => points(5, 6)).toThrow();
    expect(() => firstPlayer(0, [])).toThrow();
  });
  it("traduz erros de autenticação e rede para mensagens humanas", () => {
    expect(humanError(new Error("Invalid login credentials"))).toContain(
      "E-mail ou senha incorretos",
    );
    expect(humanError(new Error("Email not confirmed"))).toContain(
      "ainda não foi confirmado",
    );
    expect(humanError(new Error("Failed to fetch"))).toContain(
      "Sem conexão com o servidor",
    );
    expect(humanError({ message: "Request rate limit reached" })).toContain(
      "Muitas tentativas",
    );
    expect(
      humanError(
        Object.assign(
          new Error(
            'duplicate key value violates unique constraint "room_members_room_id_nickname_key"',
          ),
          { code: "23505" },
        ),
      ),
    ).toBe("Esse apelido já está em uso nesta sala. Escolha outro.");
    expect(
      humanError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "room_members_room_id_nickname_key"',
      }),
    ).toBe("Esse apelido já está em uso nesta sala. Escolha outro.");
  });
  it("seed tem 240 perguntas distintas, 30 por categoria e 6 de 22 palavras por categoria", () => {
    expect(seed).toHaveLength(240);
    expect(new Set(seed.map((q) => normalize(q.question))).size).toBe(240);
    const cats = [...new Set(seed.map((q) => q.category))];
    expect(cats).toHaveLength(8);
    for (const cat of cats) {
      const qs = seed.filter((q) => q.category === cat);
      expect(qs).toHaveLength(30);
      expect(qs.filter((q) => tokenize(q.question).length === 22)).toHaveLength(
        6,
      );
    }
    for (const q of seed) {
      expect(q.question).not.toContain("?");
      expect(` ${normalize(q.question)} `, q.id).not.toContain(
        ` ${normalize(q.answer)} `,
      );
      expect(tokenize(q.question).length).toBe(q.word_count);
      expect(q.word_count).toBeLessThanOrEqual(22);
      expect(q.review_status).toBe("provisional");
    }
  });
});
