"use client";
import { useEffect, useRef, useState } from "react";
import type { Game } from "@/lib/game";

type Feedback = {
  id: string;
  kind: "guess" | "incorrect";
  nickname: string;
  text?: string;
};
export function GameFeedback({
  game,
  onSound,
}: {
  game: Game;
  onSound: (kind: "guess" | "error") => void;
}) {
  const seen = useRef<{ match: string; guess?: string; error?: string } | null>(
    null,
  );
  const [event, setEvent] = useState<Feedback | null>(null);
  useEffect(() => {
    if (!seen.current || seen.current.match !== game.id) {
      seen.current = {
        match: game.id,
        guess: game.live_guess?.id,
        error: game.feedback?.id,
      };
      setEvent(null);
      return;
    }
    if (game.live_guess && seen.current.guess !== game.live_guess.id) {
      seen.current.guess = game.live_guess.id;
      setEvent({ ...game.live_guess, kind: "guess" });
      onSound("guess");
    }
    if (game.feedback && seen.current.error !== game.feedback.id) {
      seen.current.error = game.feedback.id;
      setEvent({ ...game.feedback, kind: "incorrect" });
      onSound("error");
    }
  }, [game.id, game.live_guess, game.feedback, onSound]);
  useEffect(() => {
    if (game.phase === "result" && game.result) setEvent(null);
  }, [game.phase, game.result]);
  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(() => setEvent(null), 3400);
    return () => clearTimeout(timer);
  }, [event]);
  if (!event) return null;
  return (
    <div
      className="game-feedback"
      data-kind={event.kind}
      data-event-id={event.id}
    >
      <section
        className="feedback-card"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="feedback-mark" aria-hidden="true">
          {event.kind === "incorrect" ? "×" : "?"}
        </span>
        <span className="feedback-kicker">
          {event.kind === "incorrect"
            ? "Palpite incorreto"
            : `Palpite de ${event.nickname}`}
        </span>
        <strong>
          {event.kind === "incorrect"
            ? "Não foi dessa vez!"
            : `“${event.text}”`}
        </strong>
        <p>
          {event.kind === "incorrect"
            ? `${event.nickname}, vamos para a próxima jogada.`
            : "Agora é com o Host."}
        </p>
      </section>
    </div>
  );
}
