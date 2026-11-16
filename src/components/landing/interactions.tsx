"use client";

import { useState, type FormEvent } from "react";

export function ScoreSimulator() {
  const [revealed, setRevealed] = useState(1);
  const points = 23 - revealed;
  return (
    <div aria-labelledby="sim-title" className="score-interaction enter">
      <div className="score-interaction-header">
        <span id="sim-title">SIMULE SUA PONTUAÇÃO</span>
        <span className="score-interaction-status">EXEMPLO · 22 PALAVRAS</span>
      </div>
      <div
        aria-label="Escolha quantas palavras já foram abertas"
        className="score-levels"
        role="group"
      >
        {[1, 4, 22].map((n) => (
          <button
            key={n}
            aria-pressed={revealed === n}
            className={`score-level${revealed === n ? " selected" : ""}`}
            data-score-step={n}
            type="button"
            onClick={() => setRevealed(n)}
          >
            <span>
              {n} {n === 1 ? "palavra" : "palavras"}
            </span>
            <strong>{String(23 - n).padStart(2, "0")}</strong>
            <small>{n === 22 ? "ponto" : "pontos"}</small>
          </button>
        ))}
      </div>
      <div
        aria-label={`${revealed} de 22 palavras reveladas; ${points} ${points === 1 ? "ponto" : "pontos"} disponíveis`}
        className="score-visual"
        data-score-visual=""
        role="img"
      >
        {Array.from({ length: 22 }, (_, i) => (
          <span
            key={i}
            className={`score-chip${i < revealed ? " revealed" : ""}`}
          />
        ))}
      </div>
      <p
        aria-atomic="true"
        aria-live="polite"
        className="score-interaction-caption"
        data-score-caption=""
      >
        <span aria-hidden="true">✦</span>
        <span data-score-sentence="">
          Acertar depois de{" "}
          <strong>
            {revealed}{" "}
            {revealed === 1 ? "palavra revelada" : "palavras reveladas"}
          </strong>{" "}
          rende{" "}
          <b>
            {points} {points === 1 ? "ponto" : "pontos"}
          </b>
          .
        </span>
      </p>
    </div>
  );
}

const question =
  "Qual planeta do Sistema Solar é conhecido pelos seus anéis feitos principalmente de gelo";
const words = question.split(" ");
type Phase = "choose" | "guess" | "win" | "loss";
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "");

/** Local demonstration only. Never reads or writes multiplayer state. */
export function DemoGame() {
  const [revealed, setRevealed] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("choose");
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState("");
  const points = Math.max(1, words.length - revealed.length + 1);
  const canGuess = phase === "guess";
  const finished = phase === "win" || phase === "loss";
  function reveal(index: number) {
    if (phase !== "choose" || revealed.includes(index)) return;
    setRevealed([...revealed, index]);
    setPhase("guess");
    setGuess("");
    setFeedback("");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canGuess) return;
    if (!guess.trim()) {
      setFeedback("Digite um palpite antes de arriscar.");
      return;
    }
    if (normalize(guess) === "saturno") {
      setPhase("win");
      setFeedback(
        `Resposta certa! Você fez ${points} ${points === 1 ? "ponto" : "pontos"} nesta demonstração.`,
      );
    } else if (revealed.length === words.length) {
      setPhase("loss");
      setFeedback("Fim da rodada. A resposta era Saturno. Ninguém pontuou.");
    } else {
      setPhase("choose");
      setFeedback("Ainda não! Abra outra palavra antes de tentar novamente.");
    }
  }
  const instruction =
    phase === "choose"
      ? revealed.length
        ? "1. Escolha outra posição para liberar uma nova pista."
        : "1. Toque em uma posição para revelar uma palavra."
      : phase === "guess"
        ? "2. Agora arrisque uma resposta. Se errar, abra mais uma palavra."
        : phase === "win"
          ? "Acertou! A rodada está concluída."
          : "Fim da rodada. Nenhuma pontuação.";
  const hint = finished
    ? `Resposta: Saturno. Pergunta: ${question}?`
    : canGuess
      ? `${revealed.length} de ${words.length} palavras reveladas. Seu palpite?`
      : revealed.length
        ? `${revealed.length} de ${words.length} palavras reveladas. A próxima pista reduz a pontuação.`
        : "Cada número esconde uma palavra da pergunta.";
  return (
    <div
      className={`demo-frame enter${phase === "win" ? " celebrate" : ""}`}
      data-demo=""
      data-phase={phase}
    >
      <div className="demo-top">
        <div className="demo-tag">EXPERIMENTE · CIÊNCIAS</div>
        <div className="demo-points" data-points="">
          {phase === "win"
            ? `+${points} ${points === 1 ? "ponto" : "pontos"}`
            : phase === "loss"
              ? "0 pontos"
              : revealed.length === 0
                ? `Até ${words.length} pontos`
                : `${points} ${points === 1 ? "ponto disponível" : "pontos disponíveis"}`}
        </div>
      </div>
      <p className="demo-instruction" data-instruction="">
        {instruction}
      </p>
      <div
        aria-label="Tabuleiro interativo com 14 posições de palavras"
        className="demo-board"
        data-board=""
        id="demo-tabuleiro"
        role="group"
      >
        {words.map((word, i) => {
          const open = revealed.includes(i);
          return (
            <button
              key={`${phase}-${revealed.length}-${i}`}
              type="button"
              className={`demo-tile${open ? " revealed" : ""}`}
              disabled={open || finished || canGuess}
              aria-label={
                open
                  ? `Posição ${i + 1}, palavra revelada: ${word}`
                  : `Revelar posição ${i + 1}`
              }
              onClick={() => reveal(i)}
            >
              {open ? (
                <>
                  <small>{i + 1}</small>
                  <span>
                    {word}
                    {i === words.length - 1 ? "?" : ""}
                  </span>
                </>
              ) : (
                i + 1
              )}
            </button>
          );
        })}
      </div>
      <div className="demo-foot">
        <span
          aria-live="polite"
          className="demo-hint"
          data-hint=""
          role="status"
        >
          {hint}
        </span>
        <button
          className="demo-reset"
          data-reset=""
          type="button"
          onClick={() => {
            setRevealed([]);
            setPhase("choose");
            setGuess("");
            setFeedback("");
          }}
        >
          ↺ Recomeçar
        </button>
      </div>
      <form className="guess-form" data-form="" onSubmit={submit}>
        <label className="guess-label" htmlFor="palpite-demo">
          Seu palpite
        </label>
        <input
          aria-label="Seu palpite"
          autoComplete="off"
          data-guess=""
          id="palpite-demo"
          maxLength={80}
          placeholder="Digite sua resposta"
          required
          type="text"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          disabled={!canGuess}
        />
        <button type="submit" disabled={!canGuess}>
          Arriscar resposta ↗
        </button>
      </form>
      <div
        aria-atomic="true"
        aria-live="polite"
        className={`feedback${feedback ? (phase === "win" ? " success" : " error") : ""}`}
        data-feedback=""
        role="status"
      >
        {feedback}
      </div>
      <noscript>
        <p className="noscript-note">
          Para experimentar a rodada, ative o JavaScript. As regras e
          informações do jogo continuam disponíveis nesta página.
        </p>
      </noscript>
    </div>
  );
}
