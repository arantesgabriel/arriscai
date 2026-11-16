"use client";

import { useEffect, useRef } from "react";

/** Play each illustration in order, waiting for its card to be on screen. */
export function FeatureSequence({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const cards = Array.from(
      container.querySelectorAll<HTMLElement>(".feature"),
    );
    const visible = new Set<Element>();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let stage = 0;
    let playing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function advance() {
      stage++;
      playing = false;
      play();
    }
    function play() {
      const card = cards[stage];
      if (!card || playing || !visible.has(card)) return;
      playing = true;
      card.classList.add("feature-animate");
      container?.setAttribute("data-animation-stage", String(stage + 1));
      if (stage === 0) timer = setTimeout(advance, reduced.matches ? 0 : 760);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });
        play();
      },
      { threshold: 0.35 },
    );
    cards.forEach((card) => observer.observe(card));
    container.addEventListener("score-finished", advance);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      container.removeEventListener("score-finished", advance);
    };
  }, []);
  return (
    <div ref={root} className="feature-grid">
      {children}
    </div>
  );
}
