"use client";

import { useEffect, useRef, useState } from "react";

export function FeatureScore() {
  const root = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let finish: ReturnType<typeof setTimeout> | undefined;
    let started = false;
    const card = root.current?.closest(".feature-score");
    function complete() {
      root.current?.dispatchEvent(
        new CustomEvent("score-finished", { bubbles: true }),
      );
    }
    function start() {
      if (started || !card?.classList.contains("feature-animate")) return;
      started = true;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setPoints(22);
        complete();
        return;
      }
      let count = 0;
      timer = setInterval(() => {
        count++;
        setPoints(Math.max(0, count));
        if (count === 22) {
          clearInterval(timer);
          finish = setTimeout(complete, 220);
        }
      }, 32);
    }
    const observer = new MutationObserver(start);
    if (card)
      observer.observe(card, { attributes: true, attributeFilter: ["class"] });
    start();
    return () => {
      observer.disconnect();
      clearInterval(timer);
      clearTimeout(finish);
    };
  }, []);
  const players = [
    { name: "Ana", points: 19 },
    { name: "Caio", points: 8 },
    { name: "Bia", points },
  ];
  const ranked = [...players].sort((a, b) => b.points - a.points);
  return (
    <div
      ref={root}
      className="score-ui animated-score"
      aria-label="Exemplo ilustrativo: Bia sai do último lugar e chega ao primeiro com 22 pontos"
    >
      {players.map((player) => {
        const rank = ranked.findIndex((p) => p.name === player.name);
        return (
          <div
            key={player.name}
            className={rank === 0 ? "leader" : ""}
            style={{ transform: `translateY(${rank * 40}px)` }}
          >
            <span>{String(rank + 1).padStart(2, "0")}</span>
            <strong>{player.name}</strong>
            <b>{String(player.points).padStart(2, "0")}</b>
          </div>
        );
      })}
    </div>
  );
}
