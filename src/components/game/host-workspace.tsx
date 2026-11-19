"use client";
import { useEffect, useRef, useState } from "react";
import type { Game, Member, Secret } from "@/lib/game";
import { Board, Scoreboard } from "./board";
import { RoundResultOverlay } from "./results";
import { GuessText } from "./guess-text";

type Props = {
  game: Game;
  secret: Secret | null;
  busy: boolean;
  permanent: boolean;
  members: Member[];
  now: number;
  onCommand: (
    command: string,
    payload?: Record<string, unknown>,
  ) => Promise<void>;
};
export function HostWorkspace({
  game,
  secret,
  busy,
  permanent,
  members,
  now,
  onCommand,
}: Props) {
  const controls = useRef<HTMLElement>(null);
  const secretContent = useRef<HTMLDivElement>(null);
  const [guess, setGuess] = useState("");
  const [spokenOpen, setSpokenOpen] = useState(false);
  const [secretOpen, setSecretOpen] = useState(false);
  const turn = game.players[game.current];
  const incomingGuessId = game.live_guess?.id;
  useEffect(() => {
    setGuess("");
    setSpokenOpen(false);
  }, [game.id, game.round, turn?.id, game.phase, incomingGuessId]);
  useEffect(() => setSecretOpen(false), [game.id, game.round]);
  useEffect(() => {
    if (secretOpen && window.matchMedia("(max-width: 800px)").matches)
      secretContent.current?.scrollIntoView({ block: "nearest" });
  }, [secretOpen]);
  useEffect(() => {
    if (game.phase === "awaiting_position" || game.phase === "result") return;
    const target = controls.current?.querySelector<HTMLElement>(
      incomingGuessId ? ".judgement" : "h2",
    );
    target?.focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 800px)").matches)
      controls.current?.scrollIntoView({ block: "nearest" });
  }, [game.phase, incomingGuessId]);
  const command = (name: string, payload: Record<string, unknown> = {}) =>
    onCommand(name, payload);
  return (
    <section className="host-workspace" aria-label="Condução da partida">
      <div className="host-round">
        <div className="host-stage">
          {game.phase === "result" ? (
            <RoundResultOverlay
              game={game}
              host
              busy={busy}
              permanent={permanent}
              onNext={() => void command("next")}
              onReserve={() => void command("reserve")}
              onReserveCustom={(question, answer) =>
                void command("reserve_custom", { question, answer })
              }
            />
          ) : (
            <Board
              game={game}
              host
              busy={busy}
              onSelect={(position) => void command("select", { position })}
            />
          )}
        </div>
        <aside
          className="host-sidebar game-sidebar"
          aria-label="Painel do Host"
        >
          <div className="sidebar-heading">
            <span>Host</span>
            <small>Você conduz a rodada</small>
          </div>
          {game.phase !== "result" && (
            <section className="panel controls host-controls" ref={controls}>
              <h2 tabIndex={-1}>
                {game.paused
                  ? "Partida pausada"
                  : game.phase === "pending_confirmation"
                    ? `Revelar posição ${(game.selected ?? 0) + 1}?`
                    : game.phase === "awaiting_guess"
                      ? game.live_guess
                        ? "Palpite recebido"
                        : "Aguardando o palpite"
                      : "Escolha uma posição"}
              </h2>
              {game.paused ? (
                <button disabled={busy} onClick={() => void command("resume")}>
                  Retomar partida
                </button>
              ) : game.phase === "pending_confirmation" ? (
                <>
                  <p>
                    A palavra só aparece para a sala depois da sua confirmação.
                  </p>
                  <div className="actions">
                    <button
                      disabled={busy}
                      onClick={() => void command("reveal")}
                    >
                      Confirmar revelação
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void command("cancel_selection")}
                    >
                      Cancelar seleção
                    </button>
                  </div>
                </>
              ) : game.phase === "awaiting_guess" ? (
                <>
                  {game.live_guess ? (
                    <div
                      className="judgement"
                      role="group"
                      aria-label="Decisão do Host"
                      tabIndex={-1}
                    >
                      <span className="guess-kicker">
                        {game.live_guess.nickname} arriscou
                      </span>
                      <GuessText
                        key={game.live_guess.id}
                        text={game.live_guess.text}
                        limit={96}
                      />
                      <p>
                        {secret?.guess
                          ? secret.suggested
                            ? "A comparação sugere acerto."
                            : "A comparação sugere erro."
                          : "Avalie o palpite."}{" "}
                        A decisão é sua.
                      </p>
                      <div className="actions judgement-actions">
                        <button
                          disabled={busy}
                          onClick={() =>
                            void command("judge", { correct: true })
                          }
                        >
                          Confirmar acerto
                        </button>
                        <button
                          className="danger"
                          disabled={busy}
                          onClick={() =>
                            void command("judge", { correct: false })
                          }
                        >
                          Confirmar erro
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p>
                        <strong>{turn?.nickname}</strong> pode digitar e enviar
                        pelo próprio dispositivo.
                      </p>
                      <button
                        type="button"
                        className="secondary"
                        aria-expanded={spokenOpen}
                        aria-controls="spoken-guess-form"
                        onClick={() => setSpokenOpen((open) => !open)}
                      >
                        Registrar um palpite falado
                      </button>
                      {spokenOpen && (
                        <form
                          id="spoken-guess-form"
                          className="guess-form spoken-guess-form"
                          aria-label="Registrar palpite falado"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void command("guess", { text: guess });
                          }}
                        >
                          <label>
                            Palpite de {turn?.nickname}
                            <input
                              autoFocus
                              required
                              maxLength={200}
                              value={guess}
                              onChange={(e) => setGuess(e.target.value)}
                              placeholder="Digite a resposta que ouviu"
                            />
                          </label>
                          <div className="actions">
                            <button disabled={busy || !guess.trim()}>
                              Comparar palpite
                            </button>
                            <button
                              type="button"
                              className="quiet"
                              onClick={() => setSpokenOpen(false)}
                            >
                              Voltar
                            </button>
                          </div>
                        </form>
                      )}
                    </>
                  )}
                  <div className="actions host-turn-actions">
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void command("pass")}
                    >
                      Jogador desistiu
                    </button>
                    <button
                      className="quiet"
                      disabled={busy || !!game.live_guess}
                      onClick={() => void command("undo")}
                    >
                      Desfazer revelação
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    É a vez de <strong>{turn?.nickname}</strong>. Todas as
                    posições continuam disponíveis no tabuleiro.
                  </p>
                  <button
                    className="secondary"
                    disabled={
                      busy ||
                      members.some(
                        (m) =>
                          m.user_id === turn?.id &&
                          now - Date.parse(m.last_seen) < 45000,
                      )
                    }
                    onClick={() => void command("skip")}
                  >
                    Pular jogador desconectado
                  </button>
                </>
              )}
            </section>
          )}
          {game.phase !== "result" && (
            <section className="host-answer">
              <button
                type="button"
                className="host-answer-toggle"
                aria-label="Resposta secreta Só você vê"
                aria-expanded={secretOpen}
                aria-controls="organizer-answer"
                onClick={() => setSecretOpen((open) => !open)}
              >
                <span>
                  Resposta secreta <small>Só você vê</small>
                </span>
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 9h12" />
                  {!secretOpen && <path d="M9 3v12" />}
                </svg>
              </button>
              {secretOpen && (
                <div
                  id="organizer-answer"
                  ref={secretContent}
                  className="host-answer-content"
                  role="region"
                  aria-label="Consulta do Host"
                >
                  {secret ? (
                    <>
                      <span className="host-answer-label">Resposta</span>
                      <strong>{secret.answer}</strong>
                      {secret.aliases.length > 0 && (
                        <small>
                          Também aceito: {secret.aliases.join(", ")}
                        </small>
                      )}
                      <p>{secret.question}</p>
                    </>
                  ) : (
                    <p>Carregando a resposta…</p>
                  )}
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => setSecretOpen(false)}
                  >
                    Fechar consulta
                  </button>
                </div>
              )}
            </section>
          )}
          <details className="host-section host-scores" open>
            <summary>Placar</summary>
            <Scoreboard game={game} pageSize={6} />
          </details>
          <details className="host-section">
            <summary>Ajustes da partida</summary>
            <section className="host-settings" aria-label="Ajustes da partida">
              <label>
                Rodadas programadas
                <input
                  aria-label="Ajustar rodadas"
                  type="number"
                  min={Math.min(8, game.round + 1)}
                  max={8}
                  disabled={busy || game.round >= 8}
                  defaultValue={game.planned}
                  key={`${game.id}-${game.round}-${game.planned}`}
                  onBlur={(e) => {
                    if (Number(e.target.value) !== game.planned)
                      void command("adjust", {
                        rounds: Number(e.target.value),
                      });
                  }}
                />
              </label>
              <div className="actions">
                <button
                  className="secondary"
                  disabled={busy || game.paused}
                  onClick={() => void command("pause")}
                >
                  Pausar
                </button>
                <button
                  disabled={busy || !game.paused}
                  onClick={() => void command("resume")}
                >
                  Retomar partida
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Cancelar partida sem declarar vencedor?"))
                      void command("cancel");
                  }}
                >
                  Cancelar partida
                </button>
              </div>
            </section>
          </details>
        </aside>
      </div>
    </section>
  );
}
