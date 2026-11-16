"use client";

import { useEffect, useRef, useState } from "react";
import { Header } from "./sections";

export default function Landing({
  children,
  fontClass,
}: {
  children: React.ReactNode;
  fontClass: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    root.current?.setAttribute("data-ready", "true");
    // Supabase implicit callbacks carry credentials in the fragment, invisible to
    // the server. Keep that fragment intact for the existing auth client.
    if (
      /(?:^#|&)(?:access_token|refresh_token|error_description)=/.test(
        location.hash,
      )
    ) {
      location.replace(`/jogar${location.search}${location.hash}`);
      return;
    }
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - innerHeight;
        if (progress.current)
          progress.current.style.width = `${max > 0 ? (scrollY / max) * 100 : 0}%`;
        setScrolled(scrollY > 50);
        frame = 0;
      });
    };
    addEventListener("scroll", update, { passive: true });
    update();
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    if (!media.matches) {
      root.current?.classList.add("motion-enabled");
      root.current
        ?.querySelectorAll(".enter")
        .forEach((element) => observer.observe(element));
    }
    return () => {
      removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  return (
    <div ref={root} className={`landing-v4 ${fontClass}`}>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <div ref={progress} aria-hidden="true" className="scroll-progress" />
      <Header scrolled={scrolled} />
      {children}
    </div>
  );
}
