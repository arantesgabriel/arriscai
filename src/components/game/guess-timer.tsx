import { guessSeconds, type Game } from "@/lib/game";

export function GuessTimer({ game, now }: { game: Game; now: number }) {
  const seconds = guessSeconds(game, now);
  if (seconds === null) return null;
  const urgent = seconds <= 10 && !game.paused;
  return (
    <div className="guess-timer" data-urgent={urgent}>
      <span>
        {game.paused
          ? "Tempo pausado"
          : seconds === 0
            ? "Tempo esgotado"
            : urgent
              ? "Envie seu palpite!"
              : "Tempo para o palpite"}
      </span>
      <span role="timer" aria-label={`${seconds} segundos para o palpite`}>
        {urgent
          ? `${seconds}s`
          : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
      </span>
      <span className="sr-only" role="status">
        {urgent ? "Últimos 10 segundos para enviar o palpite." : ""}
      </span>
    </div>
  );
}
