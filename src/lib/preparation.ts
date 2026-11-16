/** Public, ephemeral lobby preview. Never include question content or IDs here. */
export type PreparationPreview = {
  hostId: string;
  rounds: number;
  words: number | null;
  categories: string[];
  categoryOptions: string[];
  mode: "automatic" | "manual" | "mixed";
  selectedCount: number;
  availableCount: number;
};

export function readPreparation(
  value: unknown,
  hostId: string,
): PreparationPreview | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const count = (n: unknown, max: number) =>
    typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max;
  const names = (a: unknown): a is string[] =>
    Array.isArray(a) &&
    a.length <= 40 &&
    a.every((n) => typeof n === "string" && n.length <= 100);
  if (
    v.hostId !== hostId ||
    !count(v.rounds, 30) ||
    Number(v.rounds) < 1 ||
    (v.words !== null && (!count(v.words, 22) || Number(v.words) < 1)) ||
    !names(v.categories) ||
    !names(v.categoryOptions) ||
    typeof v.mode !== "string" ||
    !["automatic", "manual", "mixed"].includes(v.mode) ||
    !count(v.selectedCount, 10000) ||
    !count(v.availableCount, 10000)
  )
    return null;
  return {
    hostId,
    rounds: v.rounds as number,
    words: v.words as number | null,
    categories: [...new Set(v.categories)],
    categoryOptions: [...new Set(v.categoryOptions)],
    mode: v.mode as PreparationPreview["mode"],
    selectedCount: v.selectedCount as number,
    availableCount: v.availableCount as number,
  };
}
