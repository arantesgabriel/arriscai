"use client";
import { useEffect, useState } from "react";
import type { Game } from "@/lib/game";

export function PlayerGuess({
  game,
  uid,
  busy,
  onSubmit,
}: {
  game: Game;
  uid: string;
  busy: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const turnId = game.players[game.current]?.id;
  const mine = turnId === uid;
  useEffect(() => setText(""), [game.id, game.round, turnId, game.phase]);
  if (game.phase !== "awaiting_guess") return null;
  return (
    <section className="panel player-guess" aria-label="Palpite da rodada">
      {game.live_guess ? (
        <>
          <span className="guess-kicker">
            Palpite de {game.live_guess.nickname}
          </span>
          <p className="submitted-guess">“{game.live_guess.text}”</p>
          <p>O organizador está avaliando.</p>
        </>
      ) : mine ? (
        <>
          <h2>Sua vez de arriscar.</h2>
          <form
            className="guess-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) onSubmit(text.trim());
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
                disabled={busy || game.paused}
              />
            </label>
            <button disabled={busy || game.paused || !text.trim()}>
              Enviar palpite
            </button>
          </form>
          <p>
            Seu palpite será exibido para a sala. O organizador decide o
            resultado.
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
