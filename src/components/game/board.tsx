import type { Game } from "@/lib/game";

export function Board({
  game: g,
  host,
  busy,
  onSelect,
}: {
  game: Game;
  host: boolean;
  busy: boolean;
  onSelect: (p: number) => void;
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
      className="board-shell"
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
      <div className="board">
        {g.words.map((word, i) => (
          <button
            key={i}
            type="button"
            className={`tile ${word ? "revealed" : ""} ${g.selected === i ? "selected" : ""} ${g.last === i ? "just-opened" : ""}`}
            aria-label={word ? `Posição ${i + 1}: ${word}` : `Posição ${i + 1}`}
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
        ))}
      </div>
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

export function Scoreboard({ game }: { game: Game }) {
  return (
    <section className="panel scoreboard">
      <h2>Placar</h2>
      <ol>
        {[...game.players]
          .sort((a, b) => b.score - a.score)
          .map((p, i) => (
            <li
              key={p.id}
              className={
                game.players[game.current]?.id === p.id ? "current" : ""
              }
            >
              <span>{i + 1}</span>
              <strong>{p.nickname}</strong>
              <b>
                {p.score}
                <small>pts</small>
              </b>
            </li>
          ))}
      </ol>
    </section>
  );
}
