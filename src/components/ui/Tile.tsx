import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";
import s from "./Tile.module.css";

export type TileState = "hidden" | "selected" | "revealed";

export function Tile({
  position,
  state,
  word,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  position: number;
  state: TileState;
  word?: string;
}) {
  const revealed = state === "revealed";
  return (
    <button
      type="button"
      className={cx(s.tile, s[state], className)}
      aria-pressed={state === "selected"}
      aria-label={revealed ? `Posição ${position}: ${word}` : `Posição ${position}, oculta`}
      {...rest}
    >
      {revealed ? (
        <>
          <span className={s.number} aria-hidden="true">
            {position}
          </span>
          <span className={s.word}>{word}</span>
        </>
      ) : (
        position
      )}
    </button>
  );
}
