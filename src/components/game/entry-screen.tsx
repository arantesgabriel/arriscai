import type { ReactNode, Ref } from "react";

export type EntryMode = "create" | "join";

export function EntryForm({
  mode,
  onModeChange,
  nickname,
  onNicknameChange,
  code,
  onCodeChange,
  nicknameRef,
  ready,
  busy,
  screen,
  onEnter,
}: {
  mode: EntryMode;
  onModeChange: (mode: EntryMode) => void;
  nickname: string;
  onNicknameChange: (value: string) => void;
  code: string;
  onCodeChange: (value: string) => void;
  nicknameRef: Ref<HTMLInputElement>;
  ready: boolean;
  busy: boolean;
  screen: boolean;
  onEnter: (create: boolean) => void;
}) {
  const nameField = (
    <label>
      Como a galera te chama?
      <input
        placeholder="Seu apelido"
        ref={nicknameRef}
        value={nickname}
        maxLength={24}
        required
        autoComplete="nickname"
        onChange={(e) => onNicknameChange(e.target.value)}
      />
    </label>
  );
  return (
    <form
      className="entry entry-switcher"
      onSubmit={(e) => {
        e.preventDefault();
        onEnter(mode === "create");
      }}
    >
      <div className="entry-option" data-expanded={mode === "create"}>
        <button
          type="button"
          className="entry-option-toggle"
          aria-expanded={mode === "create"}
          aria-controls="create-room-fields"
          disabled={screen || busy}
          onClick={() => onModeChange("create")}
        >
          Criar sala
          <span aria-hidden="true">{mode === "create" ? "−" : "+"}</span>
        </button>
        {mode === "create" && (
          <div id="create-room-fields" className="entry-option-fields">
            {nameField}
            <button
              className="primary"
              type="submit"
              disabled={!ready || busy || !nickname.trim()}
            >
              Criar uma sala →
            </button>
          </div>
        )}
      </div>
      <div className="entry-option" data-expanded={mode === "join"}>
        <button
          type="button"
          className="entry-option-toggle"
          aria-expanded={mode === "join"}
          aria-controls="join-room-fields"
          disabled={busy}
          onClick={() => onModeChange("join")}
        >
          Tenho um código
          <span aria-hidden="true">{mode === "join" ? "−" : "+"}</span>
        </button>
        {mode === "join" && (
          <div id="join-room-fields" className="entry-option-fields">
            {nameField}
            <label>
              Código da sala
              <input
                placeholder="Ex.: A1B2C3D4"
                value={code}
                required
                minLength={8}
                maxLength={8}
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
              />
            </label>
            <button
              className="primary"
              type="submit"
              disabled={!ready || busy || !nickname.trim() || code.length !== 8}
            >
              Entrar
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

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
