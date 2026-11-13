export function tokenize(text: string): string[] {
  return text
    .replace(/\?+/g, "")
    .trim()
    .split(/\s+/u)
    .filter((x) => /[\p{L}\p{N}]/u.test(x));
}
export function questionText(text: string) {
  return tokenize(text).join(" ") + "?";
}
export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function suggestsCorrect(
  guess: string,
  answer: string,
  aliases: string[],
) {
  return [answer, ...aliases].some((x) => normalize(x) === normalize(guess));
}
export function points(n: number, revealed: number) {
  if (
    !Number.isInteger(n) ||
    !Number.isInteger(revealed) ||
    n < 1 ||
    n > 22 ||
    revealed < 1 ||
    revealed > n
  )
    throw new Error("Invalid word count");
  return n - revealed + 1;
}
export function firstPlayer(round: number, players: string[]) {
  if (round < 0 || !players.length) throw new Error("Invalid rotation");
  return players[round % players.length];
}
export type Phase =
  "awaiting_position" | "pending_confirmation" | "awaiting_guess" | "result";
export type Player = { id: string; nickname: string; score: number };
export type Game = {
  id: string;
  host: string;
  version: number;
  status: "active" | "completed" | "cancelled";
  paused: boolean;
  round: number;
  planned: number;
  prepared: number;
  phase: Phase;
  players: Player[];
  current: number;
  words: (string | null)[];
  selected: number | null;
  last: number | null;
  winner: string | null;
  category: string;
  result: string | null;
};
export type Member = {
  user_id: string;
  nickname: string;
  spectator: boolean;
  last_seen: string;
};
export type Snapshot = {
  id: string;
  code: string;
  host_id: string;
  members: Member[];
  game: Game | null;
  history: { id: string; ended_at: string; scores: Player[] }[];
};
export type Secret = {
  question: string;
  answer: string;
  aliases: string[];
  guess?: string;
  suggested?: boolean;
};
