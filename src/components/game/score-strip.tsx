import type { Game } from "@/lib/game";
import { Scoreboard } from "./board";

export function CompactScoreStrip({
  game,
  expanded,
  onToggle,
}: {
  game: Game;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  return (
    <div className="compact-score-bar" aria-label="Resumo do placar">
      <div
        className="score-chips"
        role="region"
        aria-label="Pontos dos jogadores, role para consultar"
        tabIndex={0}
      >
        {sorted.map((p, i) => (
          <span
            key={p.id}
            className={`score-chip ${i === 0 && p.score > 0 ? "leader" : ""} ${game.players[game.current]?.id === p.id ? "turn" : ""}`}
          >
            <strong>{p.nickname}</strong>
            <b>{p.score} pts</b>
          </span>
        ))}
      </div>
      <button
        type="button"
        className="quiet score-toggle-btn"
        onClick={onToggle}
      >
        {expanded ? "Recolher tabela" : "Classificação completa"}
      </button>
      {expanded && (
        <div className="score-drawer">
          <Scoreboard game={game} />
        </div>
      )}
    </div>
  );
}
