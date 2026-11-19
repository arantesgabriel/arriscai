"use client";
import type { Game } from "@/lib/game";
import { useEffect, useRef, useState } from "react";

export function Board({
  game: g,
  host,
  busy,
  onSelect,
  fit = false,
}: {
  game: Game;
  host: boolean;
  busy: boolean;
  onSelect: (p: number) => void;
  fit?: boolean;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(22);
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (!fit || !grid.current) return;
    const el = grid.current;
    const measure = () => {
      if (!el.clientHeight || !el.clientWidth) return;
      const style = getComputedStyle(el);
      const cols = style.gridTemplateColumns.split(" ").length;
      const gap = parseFloat(style.rowGap) || 8;
      const cell = el.clientWidth / cols - gap;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (context) context.font = `900 13px ${getComputedStyle(el).fontFamily}`;
      const longest = Math.max(
        0,
        ...g.words
          .filter((w): w is string => !!w)
          .map((w) => context?.measureText(w).width ?? w.length * 9),
      );
      const rowHeight = Math.max(
        48,
        Math.ceil(longest / Math.max(24, cell - 16)) * 18 + 18,
      );
      const rows = Math.min(
        Math.ceil(g.words.length / cols),
        Math.max(1, Math.floor((el.clientHeight + gap) / (rowHeight + gap))),
      );
      el.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
      setCapacity(cols * rows);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [fit, g.words]);
  useEffect(() => {
    const position = g.selected ?? g.last;
    if (position !== null) setPage(Math.floor(position / capacity));
    else
      setPage((p) =>
        Math.min(p, Math.max(0, Math.ceil(g.words.length / capacity) - 1)),
      );
  }, [g.selected, g.last, g.round, g.words.length, capacity]);
  const perPage = fit ? capacity : g.words.length;
  const pages = Math.max(1, Math.ceil(g.words.length / perPage));
  const shownPage = Math.min(page, pages - 1);
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
      className={`board-shell${fit ? " board-fit" : ""}`}
      id="round-board"
      tabIndex={-1}
      aria-label="Tabuleiro da rodada"
    >
      <div className="board-top">
        <div>
          <span>
            Rodada {g.round + 1}
            {g.round >= g.planned ? " · Desempate" : ` de ${g.planned}`}
          </span>
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
      <div className="board" ref={grid}>
        {g.words.map((word, i) =>
          !fit ||
          (i >= shownPage * perPage && i < (shownPage + 1) * perPage) ? (
            <button
              key={i}
              type="button"
              className={`tile ${word ? "revealed" : ""} ${g.selected === i ? "selected" : ""} ${g.last === i ? "just-opened" : ""}`}
              aria-label={
                word ? `Posição ${i + 1}: ${word}` : `Posição ${i + 1}`
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
              <span className="tile-index">{i + 1}</span>
              {word && (
                <strong>
                  {word}
                  {i === g.words.length - 1 ? "?" : ""}
                </strong>
              )}
            </button>
          ) : null,
        )}
      </div>
      {fit && (
        <nav className="board-pagination" aria-label="Páginas do tabuleiro">
          <button
            className="quiet"
            type="button"
            disabled={shownPage === 0}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Posições anteriores"
          >
            ←
          </button>
          <span>
            {pages === 1
              ? `${g.words.length} posições`
              : `Posições ${shownPage * perPage + 1}–${Math.min(g.words.length, (shownPage + 1) * perPage)} de ${g.words.length}`}
          </span>
          <button
            className="quiet"
            type="button"
            disabled={shownPage >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Próximas posições"
          >
            →
          </button>
        </nav>
      )}
      {g.phase === "pending_confirmation" && (
        <p className="board-hint" role="status">
          Posição {(g.selected ?? 0) + 1} selecionada. Aguardando confirmação.
        </p>
      )}
      {g.paused && (
        <p className="pause-banner" role="status">
          Partida pausada. O organizador precisa retomar.
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
            <span>{shown * size + i + 1}</span>
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
