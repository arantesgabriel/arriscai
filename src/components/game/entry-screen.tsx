import type { ReactNode } from "react";

/** Official entry layout; identity and room commands remain owned by GameApp. */
export function EntryScreen({ children }: { children: ReactNode }) {
  return (
    <section className="game-entry">
      <div className="entry-introduction">
        <span className="entry-kicker">O próximo palpite é seu</span>
        <h1>
          Junte a galera.
          <br />
          <span>Bora arriscar?</span>
        </h1>
        <p>Crie sua sala ou entre com o código dos amigos.</p>
        <div className="entry-cards" aria-hidden="true">
          <span>01</span>
          <span>ANÉIS</span>
          <span>03</span>
        </div>
      </div>
      <div className="entry-surface">
        <h2>Seu lugar no jogo.</h2>
        {children}
        <p className="entry-caption">Jogar não exige cadastro.</p>
      </div>
    </section>
  );
}
