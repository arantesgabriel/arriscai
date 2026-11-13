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
export function humanError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw ?? "");
  const low = msg.toLowerCase();
  if (low.includes("invalid login credentials"))
    return "E-mail ou senha incorretos. Confira seus dados ou use a opção de recuperar senha.";
  if (low.includes("email not confirmed"))
    return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada e o spam.";
  if (low.includes("user already registered"))
    return "Este e-mail já possui conta. Clique em Entrar para usar sua conta.";
  if (low.includes("password should be at least"))
    return "A senha precisa ter pelo menos 12 caracteres.";
  if (low.includes("for security purposes, you can only request"))
    return "Aguarde alguns segundos antes de solicitar outro envio de e-mail.";
  if (low.includes("failed to fetch") || low.includes("networkerror"))
    return "Sem conexão com o servidor no momento. Verifique sua internet e tente novamente.";
  if (low.includes("jwt expired") || low.includes("authentification requise"))
    return "Sua sessão expirou. Recarregue a página para reconectar.";
  return msg || "Não foi possível concluir a ação. Tente novamente.";
}
export type Phase =
  | "awaiting_position"
  | "pending_confirmation"
  | "awaiting_guess"
  | "result";
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
  answer?: string | null;
  round_points?: number;
};
export type Member = {
  user_id: string;
  nickname: string;
  spectator: boolean;
  display_only?: boolean;
  last_seen: string;
};
export type RouletteState = {
  id: string;
  winner_id: string;
  winner_nickname: string;
  mode: "roulette" | "manual";
  spun_at: string;
};
export type HistoryItem = {
  id: string;
  ended_at: string;
  scores: Player[];
  total_rounds?: number;
  host_id?: string | null;
  host_nickname?: string;
  winner_id?: string | null;
  winner_nickname?: string;
};
export type Snapshot = {
  id: string;
  code: string;
  host_id: string;
  roulette?: RouletteState | null;
  members: Member[];
  game: Game | null;
  history: HistoryItem[];
};
export type Secret = {
  question: string;
  answer: string;
  aliases: string[];
  guess?: string;
  suggested?: boolean;
};
