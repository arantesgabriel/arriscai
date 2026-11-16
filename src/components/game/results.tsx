import type { Game } from "@/lib/game";
import { Icon } from "./game-icon";
import { Scoreboard } from "./board";

export function RoundResultOverlay({
  game,
  host,
  busy,
  permanent,
  onNext,
  onReserve,
  onReserveCustom,
}: {
  game: Game;
  host: boolean;
  busy: boolean;
  permanent: boolean;
  onNext: () => void;
  onReserve: () => void;
  onReserveCustom: (q: string, a: string) => void;
}) {
  const winner = game.players.find((p) => p.id === game.result);
  const fullQuestion = game.words.filter(Boolean).join(" ") + "?";
  const earned = game.round_points ?? 0;

  return (
    <section
      className="panel round-result-overlay"
      aria-label="Resultado da rodada"
      data-outcome={winner ? "correct" : "unanswered"}
    >
      <div className="result-badge-3d">
        <Icon name={winner ? "trophy" : "star"} />
      </div>
      <span className="result-kicker">RODADA {game.round + 1} ENCERRADA</span>
      <h2>
        {winner
          ? `${winner.nickname} acertou e levou +${earned} ${earned === 1 ? "ponto" : "pontos"}!`
          : "Ninguém pontuou nesta rodada!"}
      </h2>
      {game.answer && (
        <div className="solution-reveal">
          <span>Resposta correta</span>
          <strong className="solution-answer">{game.answer}</strong>
        </div>
      )}
      <p className="solution-question">{fullQuestion}</p>

      {host && (
        <div className="overlay-host-actions">
          <button disabled={busy} onClick={onNext}>
            Avançar rodada / encerrar
          </button>
          {game.round + 1 >= game.prepared && (
            <button className="secondary" disabled={busy} onClick={onReserve}>
              Preparar pergunta extra inédita
            </button>
          )}
          {game.round + 1 >= game.prepared && permanent && (
            <details className="custom-form">
              <summary>Criar pergunta própria para o desempate</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  onReserveCustom(
                    String(data.get("question")),
                    String(data.get("answer")),
                  );
                }}
              >
                <label>
                  Pergunta inédita, até 22 palavras
                  <textarea required name="question" maxLength={1500} />
                </label>
                <label>
                  Resposta da pergunta extra
                  <input required name="answer" maxLength={200} />
                </label>
                <button disabled={busy}>Preparar pergunta própria extra</button>
              </form>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

export function VictoryStage({ game }: { game: Game }) {
  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  const champ = game.players.find((p) => p.id === game.winner) ?? sorted[0];
  const podiumOrder = [sorted[1], sorted[0], sorted[2]].filter(Boolean);

  return (
    <section className="podium" aria-label="Pódio da partida">
      <div className="podium-crown">
        <Icon name="crown" />
        <Icon name="trophy" />
      </div>
      <span className="podium-kicker">✦ FIM DE JOGO · GRANDE CAMPEÃO ✦</span>
      <p>Essa foi de</p>
      <h2>{champ?.nickname}!</h2>
      <p className="podium-sub">
        Uma boa dose de coragem. Um lugar no topo com{" "}
        <strong>{champ?.score ?? 0} pontos</strong> em {game.round + 1}{" "}
        {game.round + 1 === 1 ? "rodada" : "rodadas"}.
      </p>

      <div className="podium-3d-pedestals">
        {podiumOrder.map((p) => {
          const rank = sorted.findIndex((x) => x.id === p.id) + 1;
          return (
            <div key={p.id} className={`pedestal-col rank-${rank}`}>
              <span className="pedestal-avatar">
                {p.nickname.slice(0, 1).toUpperCase()}
              </span>
              <strong className="pedestal-name">{p.nickname}</strong>
              <span className="pedestal-score">{p.score} pts</span>
              <div className="pedestal-block">{rank}º</div>
            </div>
          );
        })}
      </div>

      <Scoreboard game={game} />
    </section>
  );
}
