"use client";
import { useEffect, useRef, useState } from "react";
import { guessSeconds, type Game } from "@/lib/game";
import { GuessTimer } from "./guess-timer";

export function PlayerGuess({
  game,
  uid,
  busy,
  onSubmit,
  now,
}: {
  game: Game;
  uid: string;
  busy: boolean;
  onSubmit: (text: string) => void;
  now: number;
}) {
  const section = useRef<HTMLElement>(null);
  const [text, setText] = useState("");
  const turnId = game.players[game.current]?.id;
  const mine = turnId === uid;
  const expired = guessSeconds(game, now) === 0;
  useEffect(() => setText(""), [game.id, game.round, turnId, game.phase]);
  useEffect(() => {
    if (
      game.phase === "awaiting_guess" &&
      mine &&
      !game.live_guess &&
      window.matchMedia("(max-width: 800px)").matches
    )
      section.current?.scrollIntoView({ block: "nearest" });
  }, [game.phase, mine, game.live_guess]);
  if (game.phase !== "awaiting_guess") return null;
  return (
    <section
      ref={section}
      className="panel player-guess"
      aria-label="Palpite da rodada"
    >
      {game.live_guess ? (
        <>
          <span className="guess-kicker">
            Palpite de {game.live_guess.nickname}
          </span>
          <p className="submitted-guess">“{game.live_guess.text}”</p>
          <p>O Host está avaliando.</p>
        </>
      ) : mine ? (
        <>
          <h2>Sua vez de arriscar.</h2>
          <div className="guess-input-timer">
            <GuessTimer game={game} now={now} />
          </div>
          <form
            className="guess-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim() && !expired && !game.paused)
                onSubmit(text.trim());
            }}
          >
            <label>
              Seu palpite
              <input
                required
                maxLength={200}
                autoComplete="off"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Digite sua resposta"
                disabled={busy || game.paused || expired}
              />
            </label>
            <button disabled={busy || game.paused || expired || !text.trim()}>
              Enviar palpite
            </button>
          </form>
          <p>
            Seu palpite será exibido para a sala. O Host decide o resultado.
          </p>
        </>
      ) : (
        <p>
          Aguardando o palpite de{" "}
          <strong>{game.players[game.current]?.nickname}</strong>.
        </p>
      )}
    </section>
  );
}
