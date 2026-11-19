"use client";
import type { Game } from "@/lib/game";
import { useState, type CSSProperties } from "react";
import { playerColor } from "./player-colors";
import { GuessTimer } from "./guess-timer";

export function Board({
  game: g,
  host,
  busy,
  onSelect,
  now,
}: {
  game: Game;
  host: boolean;
  busy: boolean;
  onSelect: (p: number) => void;
  now: number;
}) {
  const revealed = g.words.filter((x) => x !== null).length;
  const isResult = g.phase === "result";
  const availablePoints = Math.max(
    1,
    g.words.length - revealed + (g.phase === "awaiting_guess" ? 1 : 0),
  );
  const displayPoints = isResult ? (g.round_points ?? 0) : availablePoints;
  const pointsLabel = isResult
    ? g.result
      ? displayPoints === 1
        ? "ponto conquistado"
        : "pontos conquistados"
      : "sem vencedor"
    : availablePoints === 1
      ? "ponto em jogo"
      : "pontos em jogo";

  return (
    <section
      className="board-shell match-board"
      style={
        {
          "--board-columns":
            g.words.length <= 9
              ? Math.min(3, g.words.length)
              : g.words.length <= 16
                ? 4
                : 5,
          "--board-columns-mobile": Math.min(
            g.words.length <= 9 ? 3 : 4,
            g.words.length,
          ),
        } as CSSProperties
      }
      id="round-board"
      tabIndex={-1}
      aria-label="Tabuleiro da rodada"
    >
      <div className="round-status-row">
        <span className="round-index">
          Rodada {g.round + 1}
          {g.round >= g.planned ? " · Desempate" : ` de ${g.planned}`}
        </span>

        <span
          className="round-status"
          data-state={g.paused ? "paused" : g.phase}
        >
          {g.paused
            ? "Partida pausada"
            : isResult
              ? "Rodada encerrada"
              : g.phase === "pending_confirmation"
                ? "Confirme a posição"
                : g.phase === "awaiting_guess"
                  ? g.live_guess
                    ? "Palpite recebido"
                    : "Hora do palpite"
                  : host
                    ? "Escolha uma posição"
                    : "Peça uma posição ao Host"}
        </span>
      </div>
      <div className="board-top">
        <div>
          <h2>
            {isResult
              ? "Pergunta revelada"
              : `É a vez de ${g.players[g.current]?.nickname}`}
          </h2>
        </div>
        <div className={`points ${isResult ? "points-result" : ""}`}>
          <strong>{displayPoints}</strong>
          <span>{pointsLabel}</span>
        </div>
      </div>
      <div className="board-category">
        {g.category}
        <span>
          {revealed} de {g.words.length} palavras
        </span>
      </div>
      <GuessTimer game={g} now={now} />
      {g.timed_out && (
        <p className="board-hint" role="status">
          O tempo de {g.timed_out.nickname} acabou. A vez passou.
        </p>
      )}
      <div
        className="round-progress"
        role="progressbar"
        aria-label="Palavras reveladas"
        aria-valuemin={0}
        aria-valuemax={g.words.length}
        aria-valuenow={revealed}
      >
        <span style={{ width: `${(revealed / g.words.length) * 100}%` }} />
      </div>
      <div className="board">
        {g.words.map((word, i) => (
          <button
            key={i}
            type="button"
            className={`tile ${word ? "revealed" : ""} ${g.selected === i ? "selected" : ""} ${g.last === i ? "just-opened" : ""}`}
            aria-label={
              word
                ? `Posição ${i + 1} ${word}${i === g.words.length - 1 ? "?" : ""}`
                : `Posição ${i + 1}`
            }
            aria-pressed={g.selected === i}
            disabled={
              busy ||
              !host ||
              g.paused ||
              g.phase !== "awaiting_position" ||
              word !== null
            }
            onClick={() => onSelect(i)}
          >
            <span className="tile-index" aria-hidden="true">
              {i + 1}
            </span>{" "}
            {word && (
              <strong>
                {word}
                {i === g.words.length - 1 ? "?" : ""}
              </strong>
            )}
          </button>
        ))}
      </div>
      {g.phase === "pending_confirmation" && (
        <p className="board-hint" role="status">
          Posição {(g.selected ?? 0) + 1} selecionada. Aguardando confirmação.
        </p>
      )}
      {g.paused && (
        <p className="pause-banner" role="status">
          Partida pausada. O Host precisa retomar.
        </p>
      )}
    </section>
  );
}

export function Scoreboard({
  game,
  pageSize,
}: {
  game: Game;
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);
  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  const size = pageSize ?? sorted.length;
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const shown = Math.min(page, pages - 1);
  return (
    <section className="panel scoreboard">
      <h2>Placar</h2>
      <ol>
        {sorted.slice(shown * size, (shown + 1) * size).map((p, i) => (
          <li
            key={p.id}
            className={game.players[game.current]?.id === p.id ? "current" : ""}
          >
            <span className="score-rank">{shown * size + i + 1}</span>
            <span
              className="score-avatar"
              aria-hidden="true"
              style={{
                backgroundColor: playerColor(
                  game.players.findIndex((player) => player.id === p.id),
                ),
              }}
            >
              {p.nickname.slice(0, 1).toLocaleUpperCase("pt-BR")}
            </span>
            <strong>{p.nickname}</strong>
            <b>
              {p.score}
              <small>pts</small>
            </b>
          </li>
        ))}
      </ol>
      {pages > 1 && (
        <nav className="board-pagination" aria-label="Páginas do placar">
          <button
            className="quiet"
            disabled={shown === 0}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Jogadores anteriores"
          >
            ←
          </button>
          <span>
            {shown + 1} de {pages}
          </span>
          <button
            className="quiet"
            disabled={shown === pages - 1}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Próximos jogadores"
          >
            →
          </button>
        </nav>
      )}
    </section>
  );
}
