import { FeatureScore } from "./feature-score";
import { FeatureSequence } from "./feature-sequence";
import { ScoreSimulator, DemoGame } from "./interactions";
export function Header({ scrolled }: { scrolled: boolean }) {
  return (
    <header className={scrolled ? "top scrolled" : "top"} id="top">
      <nav aria-label="Navegação principal" className="nav shell">
        <a
          aria-label="Arriscaí, voltar ao início"
          className="logo"
          href="#inicio"
        >
          Arriscaí<span>!</span>
        </a>
        <div className="links">
          <a href="#como">Como funciona</a>
          <a href="#teste">Experimente</a>
          <a className="btn btn-primary nav-cta" href="/jogar">
            Jogar grátis{" "}
            <svg
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M5 12h14m-6-6 6 6-6 6"></path>
            </svg>
          </a>
        </div>
      </nav>
    </header>
  );
}
export function Hero() {
  return (
    <section className="hero" id="inicio">
      <div aria-hidden="true" className="stars"></div>
      <div className="hero-layout shell">
        <div className="hero-copy enter">
          <div className="overline">JOGO DE ADIVINHAÇÃO ENTRE AMIGOS</div>
          <h1 className="display">
            Vire a pista.
            <br />
            <em>Arrisque.</em>
          </h1>
          <p>
            <span className="desktop-copy">
              Uma pergunta escondida, uma palavra por vez. Acerte antes dos seus
              amigos e conquiste mais pontos.
            </span>
            <span className="mobile-copy">
              Uma palavra por vez. Descubra a resposta antes dos amigos.
            </span>
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="/jogar">
              Jogar grátis{" "}
              <svg
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M5 12h14m-6-6 6 6-6 6"></path>
              </svg>
            </a>
            <a className="hero-text-link" href="#como">
              Entenda o jogo <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        <div
          aria-label="Ilustração conceitual: tabuleiro de 12 palavras com a posição 7 revelada mostrando ANÉIS, moeda com 12 pontos e portal ao fundo"
          className="scene"
          role="img"
        >
          <div className="scene-halo"></div>
          <div className="portal-rays"></div>

          <div className="portal"></div>
          <div className="star-asset">✶</div>
          <div className="game-card">
            <div className="card-head">
              <label>Rodada 01 · Ciências</label>
              <strong>AO VIVO</strong>
            </div>
            <div className="card-tiles">
              <span>01</span>
              <span>02</span>
              <span>03</span>
              <span>04</span>
              <span>05</span>
              <span>07</span>
              <span className="active">ANÉIS</span>
              <span>08</span>
              <span>09</span>
              <span>10</span>
              <span>11</span>
              <span>12</span>
            </div>
            <div className="card-foot">
              <span>1 de 12 palavras reveladas</span>
              <b>Sua vez de arriscar ✦</b>
            </div>
          </div>
          <div className="coin">
            12<small>PTS</small>
          </div>
        </div>
      </div>
    </section>
  );
}
export function ScoreSection() {
  return (
    <section
      aria-labelledby="score-title"
      className="score-interlude"
      id="pontos"
    >
      <div className="shell score-interlude-grid">
        <div className="score-intro enter">
          <span className="score-eye">
            <span aria-hidden="true" className="score-eye-mark">
              ✳
            </span>{" "}
            CADA PISTA CONTA
          </span>
          <h2 id="score-title">
            O melhor momento
            <br /> é <em>antes.</em>
          </h2>
          <p>
            <span className="desktop-copy">
              Em uma pergunta com <strong>22 palavras</strong>, acertar cedo faz
              toda a diferença.
            </span>
            <span className="mobile-copy">
              Acerte com menos pistas. Ganhe mais pontos.
            </span>
          </p>
          <p className="score-explainer">
            A primeira pista vale 22 pontos. Cada pista extra tira 1 ponto do
            acerto.
          </p>
        </div>
        <ScoreSimulator />
      </div>
    </section>
  );
}
export function HowItWorks() {
  return (
    <section className="section how" id="como">
      <div className="shell">
        <div className="how-head">
          <div className="enter">
            <div className="overline sec-kicker">A MECÂNICA</div>
            <h2>
              <span className="desktop-copy">
                Regras simples.
                <br />
                Reações enormes.
              </span>
              <span className="mobile-copy">Aprenda em três passos.</span>
            </h2>
          </div>
          <p className="lead-small enter">
            Três movimentos. Um monte de reviravoltas no placar.
          </p>
        </div>
        <div className="steps">
          <article className="step enter" data-symbol="1">
            <span className="num">01 / ESCOLHA</span>
            <div className="step-icon">01</div>
            <h3>Escolha uma posição.</h3>
            <p>
              Toque em uma posição. O organizador confirma e abre a palavra
              escondida.
            </p>
          </article>
          <article className="step enter" data-symbol="?">
            <span className="num">02 / ARRISQUE</span>
            <div className="step-icon">?</div>
            <h3>Arrisque a resposta.</h3>
            <p>
              Com a nova pista, tente descobrir a resposta da pergunta completa.
            </p>
          </article>
          <article className="step enter" data-symbol="★">
            <span className="num">03 / VENÇA</span>
            <div className="step-icon">+22</div>
            <h3>Acerte cedo. Pontue mais.</h3>
            <p>
              Cada palavra aberta reduz o valor disponível. Quem acerta primeiro
              leva os pontos.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
export function DemoSection() {
  return (
    <section className="section demo" id="teste">
      <div className="shell demo-layout">
        <div className="demo-copy enter">
          <div className="overline sec-kicker">UM GOSTINHO DO JOGO</div>
          <h2>
            <span className="desktop-copy">Seu instinto vale pontos.</span>
            <span className="mobile-copy">Teste seu palpite.</span>
          </h2>
          <p className="lead-small">
            <span className="desktop-copy">
              Escolha uma posição, abra uma palavra e tente descobrir a
              resposta. A demonstração é individual; no jogo real, o organizador
              conduz as jogadas.
            </span>
            <span className="mobile-copy">
              Abra uma palavra e tente acertar. No multiplayer, o organizador
              conduz a rodada.
            </span>
          </p>
          <a className="demo-invite" href="#demo-tabuleiro">
            <span aria-hidden="true">↗</span> Experimente: escolha uma posição
          </a>
        </div>
        <DemoGame />
      </div>
    </section>
  );
}
export function Features() {
  return (
    <section
      aria-labelledby="features-title"
      className="section features"
      id="jogar"
    >
      <div className="shell">
        <div className="features-head enter">
          <div>
            <div className="overline sec-kicker">TODO MUNDO ENTRA NO JOGO</div>
            <h2 id="features-title">
              <span className="desktop-copy">
                É melhor quando
                <br /> a galera participa.
              </span>
              <span className="mobile-copy">Jogue com a galera.</span>
            </h2>
          </div>
          <p className="lead-small">
            Seja no sofá ou à distância, o jogo é de todo mundo.
          </p>
        </div>
        <FeatureSequence>
          <article className="feature feature-room enter">
            <span className="feature-eyebrow">01 / CONVIDE</span>
            <h3>Sua sala. Sua galera.</h3>
            <p>Crie uma sala, copie o código e chame os amigos.</p>
            <div
              aria-label="Exemplo de uma sala com três participantes"
              className="room-ui"
            >
              <span className="room-code-label">
                SALA <b>7A3C1F2B</b>
              </span>
              <div className="avatar-row">
                <span aria-label="Ana">A</span>
                <span aria-label="Bia">B</span>
                <span aria-label="Caio">C</span>
                <span className="room-plus">+ você</span>
              </div>
            </div>
          </article>
          <article className="feature feature-score enter">
            <span className="feature-eyebrow">02 / DISPUTE</span>
            <h3>Uma rodada muda tudo.</h3>
            <p>
              <span className="desktop-copy">
                Escolhas ousadas rendem pontos. O placar acompanha cada acerto.
              </span>
              <span className="mobile-copy">
                Cada acerto pode virar o placar.
              </span>
            </p>
            <FeatureScore />
          </article>
          <article className="feature feature-tv enter">
            <span className="feature-eyebrow">03 / ACOMPANHE</span>
            <h3>Todo mundo de olho.</h3>
            <p>
              <span className="desktop-copy">
                Na tela de cada jogador ou no modo telão, as pistas aparecem
                para a galera.
              </span>
              <span className="mobile-copy">
                As pistas chegam a todos, no celular ou no telão.
              </span>
            </p>
            <div aria-label="Exemplo visual do modo telão" className="tv-ui">
              <div className="tv-glass">
                <span>É A VEZ DA BIA</span>
                <strong>
                  <i>?</i>
                  <i>?</i>
                  <i className="tv-flip">
                    <span className="tv-face tv-back">?</span>
                    <span className="tv-face tv-front">GELO</span>
                  </i>
                  <i>?</i>
                </strong>
              </div>
              <div className="tv-stand"></div>
            </div>
          </article>
        </FeatureSequence>
      </div>
    </section>
  );
}
export function FinalCallToAction() {
  return (
    <section className="cta">
      <span aria-hidden="true" className="cta-mark">
        ✦
      </span>
      <span aria-hidden="true" className="cta-mark right">
        ?
      </span>
      <div className="shell enter">
        <span className="pill">A próxima rodada é sua</span>
        <h2>Chame a galera. O próximo palpite é seu.</h2>
        <p>Crie sua sala grátis, compartilhe o código e comece a partida.</p>
        <a className="btn btn-dark" href="/jogar">
          Jogar grátis ↗
        </a>
      </div>
    </section>
  );
}
export function Footer() {
  return (
    <footer className="footer shell">
      <div className="footer-brand">
        <span className="logo">
          Arriscaí<span>!</span>
        </span>
        <span>Quanto menos pistas, mais pontos!</span>
      </div>
      <nav aria-label="Links do rodapé" className="footer-nav">
        <a href="#como">Como funciona</a>
        <a href="#teste">Demonstração</a>
        <a href="/jogar">Jogar grátis</a>
        <a href="#inicio">Voltar ao topo ↑</a>
      </nav>
    </footer>
  );
}
