"use client";
import { useState } from "react";

export function GuessText({
  text,
  limit = 96,
}: {
  text: string;
  limit?: number;
}) {
  const [page, setPage] = useState(0);
  const chars = Array.from(text);
  const pages = Math.max(1, Math.ceil(chars.length / limit));
  const shown = Math.min(page, pages - 1);
  return (
    <>
      <p className="submitted-guess">
        “{chars.slice(shown * limit, (shown + 1) * limit).join("")}
        {shown < pages - 1 ? "…" : ""}”
      </p>
      {pages > 1 && (
        <nav className="board-pagination" aria-label="Trechos do palpite">
          <button
            className="quiet"
            disabled={shown === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ←
          </button>
          <span>
            Palpite {shown + 1} de {pages}
          </span>
          <button
            className="quiet"
            disabled={shown === pages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </button>
        </nav>
      )}
    </>
  );
}
