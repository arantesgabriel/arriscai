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
  const [view, setView] = useState("round");
  const [inspectBoard, setInspectBoard] = useState<boolean | null>(null);
  const [guess, setGuess] = useState("");
  const [height, setHeight] = useState(800);
  const [secretPage, setSecretPage] = useState(0);
  const secretDialog = useRef<HTMLDialogElement>(null);
  const controls = useRef<HTMLElement>(null);
  const spokenDialog = useRef<HTMLDialogElement>(null);
  const turn = game.players[game.current];
  const incomingGuessId = game.live_guess?.id;
  useEffect(() => setGuess(""), [game.id, game.round, turn?.id, game.phase]);
  const pane = game.paused
    ? "controls"
    : inspectBoard !== null
      ? inspectBoard
        ? "board"
        : "controls"
      : game.phase !== "awaiting_position"
        ? "controls"
        : "board";
  useEffect(() => {
    const resize = () =>
      setHeight(window.visualViewport?.height ?? innerHeight);
    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, []);
  useEffect(() => {
    setView("round");
    setInspectBoard(null);
    setSecretPage(0);
  }, [game.id, game.round]);
  useEffect(() => {
    if (incomingGuessId) {
      spokenDialog.current?.close();
      setView("round");
      setInspectBoard(null);
    }
  }, [incomingGuessId]);
  useEffect(() => {
    if (
      view !== "round" ||
      pane !== "controls" ||
      !window.matchMedia("(max-width: 800px)").matches
    )
      return;
    const target = controls.current?.querySelector<HTMLElement>(
      incomingGuessId ? ".judgement" : "h2",
    );
    target?.focus({ preventScroll: true });
  }, [view, pane, game.phase, incomingGuessId]);
  const command = (name: string, payload: Record<string, unknown> = {}) => {
    setInspectBoard(null);
    return onCommand(name, payload);
  };
  const questionWords = secret?.question.split(/\s+/) ?? [];
  const secretSize = height < 600 ? 4 : 8;
  const secretPages = Math.max(1, Math.ceil(questionWords.length / secretSize));
  const shownSecret = Math.min(secretPage, secretPages - 1);
  return (
    <section className="host-workspace" aria-label="Condução da partida">
      <nav className="host-tabs" aria-label="Painéis do organizador">
        {[
          ["round", "Rodada"],
          ["scores", "Placar"],
          ["settings", "Ajustes"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={view === id ? "selected" : "quiet"}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="secondary host-secret-button"
          onClick={() => secretDialog.current?.showModal()}
        >
          Resposta secreta
        </button>
      </nav>
      {view === "round" ? (
        game.phase === "result" ? (
          <RoundResultOverlay
            game={game}
            host
            busy={busy}
            permanent={permanent}
            questionPageSize={height < 600 ? 4 : 8}
            onNext={() => void command("next")}
            onReserve={() => void command("reserve")}
            onReserveCustom={(question, answer) =>
              void command("reserve_custom", { question, answer })
            }
          />
        ) : (
          <>
            <div
              className="host-mobile-switch"
              role="group"
              aria-label="Operação da rodada"
            >
              <button
                className={pane === "board" ? "selected" : "quiet"}
                aria-pressed={pane === "board"}
                onClick={() => setInspectBoard(true)}
              >
                Tabuleiro
              </button>
              <button
                className={pane === "controls" ? "selected" : "quiet"}
                aria-pressed={pane === "controls"}
                onClick={() => setInspectBoard(false)}
              >
                Condução
              </button>
            </div>
            <div className="host-round" data-pane={pane}>
              <Board
                game={game}
                host
                busy={busy}
                fit
                onSelect={(position) => void command("select", { position })}
              />
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
                  <button
                    disabled={busy}
                    onClick={() => void command("resume")}
                  >
                    Retomar partida
                  </button>
                ) : game.phase === "pending_confirmation" ? (
                  <>
                    <p>
                      A palavra só aparece para a sala depois da sua
                      confirmação.
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
                        aria-label="Decisão do organizador"
                        tabIndex={-1}
                      >
                        <span className="guess-kicker">
                          {game.live_guess.nickname} arriscou
                        </span>
                        <GuessText
                          key={game.live_guess.id}
                          text={game.live_guess.text}
                          limit={height < 600 ? 32 : height < 800 ? 64 : 96}
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
                          <strong>{turn?.nickname}</strong> pode digitar e
                          enviar pelo próprio dispositivo.
                        </p>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => spokenDialog.current?.showModal()}
                        >
                          Registrar um palpite falado
                        </button>
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
            </div>
          </>
        )
      ) : view === "scores" ? (
        <Scoreboard
          game={game}
          pageSize={height < 600 ? 2 : height < 800 ? 4 : 6}
        />
      ) : (
        <section className="panel host-settings">
          <h2>Ajustes da partida</h2>
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
                  void command("adjust", { rounds: Number(e.target.value) });
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
      )}
      <dialog
        ref={spokenDialog}
        className="host-secret-dialog host-manual-dialog"
        aria-labelledby="manual-guess-title"
      >
        <div className="secret-dialog-heading">
          <h2 id="manual-guess-title">Registrar palpite falado</h2>
          <button
            className="quiet"
            type="button"
            onClick={() => spokenDialog.current?.close()}
          >
            Voltar
          </button>
        </div>
        <form
          className="guess-form"
          onSubmit={(e) => {
            e.preventDefault();
            void command("guess", { text: guess });
          }}
        >
          <label>
            Palpite de {turn?.nickname}
            <input
              required
              maxLength={200}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Digite a resposta que ouviu"
            />
          </label>
          <button disabled={busy || !guess.trim()}>Comparar palpite</button>
        </form>
      </dialog>
      <dialog
        ref={secretDialog}
        className="host-secret-dialog"
        aria-labelledby="secret-title"
      >
        <div className="secret-dialog-heading">
          <h2 id="secret-title">Consulta do organizador</h2>
          <button
            type="button"
            className="quiet"
            onClick={() => secretDialog.current?.close()}
          >
            Fechar consulta
          </button>
        </div>
        {secret && (
          <section className="private">
            <span>Só você vê · pergunta</span>
            <p>
              {questionWords
                .slice(shownSecret * secretSize, (shownSecret + 1) * secretSize)
                .join(" ")}
              {shownSecret < secretPages - 1 ? "…" : ""}
            </p>
            {secretPages > 1 && (
              <nav
                className="board-pagination"
                aria-label="Trechos da pergunta secreta"
              >
                <button
                  className="quiet"
                  disabled={shownSecret === 0}
                  onClick={() => setSecretPage((p) => p - 1)}
                >
                  ←
                </button>
                <span>
                  Trecho {shownSecret + 1} de {secretPages}
                </span>
                <button
                  className="quiet"
                  disabled={shownSecret === secretPages - 1}
                  onClick={() => setSecretPage((p) => p + 1)}
                >
                  →
                </button>
              </nav>
            )}
            <span>Resposta</span>
            <strong>{secret.answer}</strong>
            {secret.aliases.length > 0 && (
              <small>Também aceito: {secret.aliases.join(", ")}</small>
            )}
          </section>
        )}
      </dialog>
    </section>
  );
}
