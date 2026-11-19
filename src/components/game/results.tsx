"use client";
import type { Game } from "@/lib/game";
import { useRef, useState } from "react";
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
  questionPageSize,
}: {
  game: Game;
  host: boolean;
  busy: boolean;
  permanent: boolean;
  onNext: () => void;
  onReserve: () => void;
  onReserveCustom: (q: string, a: string) => void;
  questionPageSize?: number;
}) {
  const [questionPage, setQuestionPage] = useState(0);
  const customDialog = useRef<HTMLDialogElement>(null);
  const winner = game.players.find((p) => p.id === game.result);
  const fullQuestion = game.words.filter(Boolean).join(" ") + "?";
  const earned = game.round_points ?? 0;
  const size = questionPageSize ?? game.words.length;
  const pages = Math.ceil(game.words.length / size);
  const page = Math.min(questionPage, pages - 1);
  const shownQuestion = questionPageSize
    ? game.words
        .slice(page * size, (page + 1) * size)
        .filter(Boolean)
        .join(" ") + (page === pages - 1 ? "?" : "…")
    : fullQuestion;

  return (
    <section
      className="panel round-result-overlay"
      aria-label="Resultado da rodada"
      data-outcome={winner ? "correct" : "unanswered"}
    >
      <header className="round-result-summary">
        <div className="result-badge-3d">
          <Icon name={winner ? "trophy" : "star"} />
        </div>
        <div className="result-winner">
          <span className="result-kicker">
            Rodada {game.round + 1} encerrada
          </span>
          <h2>
            {winner
              ? `${winner.nickname} acertou!`
              : "Essa ficou sem vencedor."}
          </h2>
        </div>
        <div className="round-reward">
          <strong>{winner ? `+${earned}` : "0"}</strong>
          <span>{earned === 1 ? "ponto" : "pontos"}</span>
        </div>
      </header>
      <div className="result-solution">
        {game.answer && (
          <div className="solution-reveal">
            <span>Resposta da rodada</span>
            <strong className="solution-answer">{game.answer}</strong>
          </div>
        )}
        <div className="result-question">
          <p className="solution-question">{shownQuestion}</p>
          {pages > 1 && (
            <nav
              className="board-pagination"
              aria-label="Trechos da pergunta revelada"
            >
              <button
                className="quiet"
                disabled={page === 0}
                onClick={() => setQuestionPage((p) => p - 1)}
              >
                ←
              </button>
              <span>
                Trecho {page + 1} de {pages}
              </span>
              <button
                className="quiet"
                disabled={page === pages - 1}
                onClick={() => setQuestionPage((p) => p + 1)}
              >
                →
              </button>
            </nav>
          )}
        </div>
      </div>

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
            <>
              <button
                className="secondary"
                onClick={() => customDialog.current?.showModal()}
              >
                Criar pergunta própria para o desempate
              </button>
              <dialog
                ref={customDialog}
                className="host-secret-dialog"
                aria-labelledby="custom-extra-title"
              >
                <div className="secret-dialog-heading">
                  <h2 id="custom-extra-title">Pergunta extra</h2>
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => customDialog.current?.close()}
                  >
                    Voltar
                  </button>
                </div>
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
                  <button disabled={busy}>
                    Preparar pergunta própria extra
                  </button>
                </form>
              </dialog>
            </>
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
