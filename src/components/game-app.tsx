"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { configured, identity, rpc, supabase } from "@/lib/supabase";
import type { Snapshot, Secret, Game } from "@/lib/game";
type Catalog = {
  id: string;
  category: string;
  question: string;
  word_count: number;
  own: boolean;
};
const categories = [
  "Conhecimentos gerais",
  "Filmes e séries",
  "Música",
  "Esportes",
  "Geografia",
  "História",
  "Ciência e tecnologia",
  "Cultura pop",
];
function Icon({ name }: { name: "star" | "trophy" | "arrow" }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      {name === "star" ? (
        <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" />
      ) : name === "trophy" ? (
        <>
          <path d="M7 3h10v7a5 5 0 0 1-10 0V3Zm5 12v6m-4 0h8M7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4" />
        </>
      ) : (
        <path d="m9 5 7 7-7 7" />
      )}
    </svg>
  );
}
export default function GameApp({ roomId }: { roomId?: string }) {
  const router = useRouter();
  const [now, setNow] = useState(0);
  const [uid, setUid] = useState("");
  const [permanent, setPermanent] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [auth, setAuth] = useState(false);
  const [sound, setSound] = useState(false);
  const [volume, setVolume] = useState(0.25);
  const [online, setOnline] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [screen, setScreen] = useState(false);
  const [catalog, setCatalog] = useState<Catalog[]>([]);
  const [rounds, setRounds] = useState(3);
  const [exact, setExact] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [mode, setMode] = useState("automatic");
  const [chosen, setChosen] = useState<string[]>([]);
  const [guess, setGuess] = useState("");
  const [custom, setCustom] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editSecret, setEditSecret] = useState<
    (Secret & { category: string }) | null
  >(null);
  const lastVersion = useRef(0);
  const refreshSequence = useRef(0);
  const locked = useRef(false);
  const refresh = useCallback(async () => {
    if (!roomId) return;
    const sequence = ++refreshSequence.current;
    const s = await rpc<Snapshot>("public_room_snapshot", { room: roomId });
    if (sequence !== refreshSequence.current) return;
    setNow(Date.now());
    setSnapshot((prev) => {
      if (
        prev?.game?.id === s.game?.id &&
        (prev?.game?.version ?? 0) > (s.game?.version ?? 0)
      )
        return prev;
      return s;
    });
    const {
      data: { user },
    } = await supabase().auth.getUser();
    if (sequence !== refreshSequence.current) return;
    if (
      user &&
      s.host_id === user.id &&
      s.game?.status === "active" &&
      !new URLSearchParams(window.location.search).has("telao")
    ) {
      const data = await rpc<Secret>("host_private_round_snapshot", {
        room: roomId,
      });
      if (sequence === refreshSequence.current) setSecret(data);
    } else setSecret(null);
  }, [roomId]);
  async function act(fn: () => Promise<unknown>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
      if (roomId) await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível concluir. Tente novamente.",
      );
      if (roomId) await refresh().catch(() => {});
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setCode(query.get("codigo") ?? "");
    setScreen(query.has("telao"));
    setNow(Date.now());
    if (query.has("telao")) setNickname("Telão");
    setSound(sessionStorage.getItem("sound") === "true");
    setVolume(Number(sessionStorage.getItem("volume") ?? 0.25));
    if (!configured()) return;
    let alive = true;
    identity()
      .then((u) => {
        if (alive) {
          setUid(u.id);
          setPermanent(!u.is_anonymous);
        }
      })
      .catch((e) => setError(e.message));
    const {
      data: { subscription },
    } = supabase().auth.onAuthStateChange((_event, session) => {
      if (alive && session) {
        setUid(session.user.id);
        setPermanent(!session.user.is_anonymous);
      }
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!roomId || !uid) return;
    let alive = true;
    let channel: ReturnType<ReturnType<typeof supabase>["channel"]> | undefined;
    const load = async () => {
      try {
        await refresh();
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    void load();
    void supabase()
      .auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!alive) return;
        await supabase().realtime.setAuth(session?.access_token);
        if (!alive) return;
        channel = supabase()
          .channel(`room:${roomId}`, {
            config: { private: true, presence: { key: uid } },
          })
          .on("broadcast", { event: "state_changed" }, () => void load())
          .on("presence", { event: "sync" }, () => {
            if (channel) setOnline(Object.keys(channel.presenceState()));
          })
          .subscribe((status) => {
            setConnected(status === "SUBSCRIBED");
            if (status === "SUBSCRIBED") {
              void channel?.track({ user_id: uid });
              void load();
            }
          });
      });
    const heartbeat = () => {
      void rpc("heartbeat", { room: roomId })
        .then(load)
        .catch(() => setConnected(false));
    };
    heartbeat();
    const timer = setInterval(heartbeat, 15000);
    const focus = () => void load();
    window.addEventListener("online", focus);
    window.addEventListener("focus", focus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("online", focus);
      window.removeEventListener("focus", focus);
      if (channel) void supabase().removeChannel(channel);
    };
  }, [roomId, uid, refresh]);
  const host = Boolean(snapshot && snapshot.host_id === uid && !screen);
  const game = snapshot?.game;
  const active = game?.status === "active";
  useEffect(() => {
    if (!host || active || !roomId) return;
    rpc<Catalog[]>("question_catalog", { room: roomId })
      .then((q) => {
        setCatalog(q);
        setCats([...new Set(q.map((x) => x.category))]);
      })
      .catch((e) => setError(e.message));
  }, [host, active, roomId]);
  useEffect(() => {
    if (!game) return;
    if (lastVersion.current && game.version > lastVersion.current && sound) {
      const audio = new AudioContext();
      const o = audio.createOscillator(),
        gain = audio.createGain();
      o.connect(gain);
      gain.connect(audio.destination);
      gain.gain.setValueAtTime(volume * 0.15, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);
      o.frequency.value = game.phase === "result" ? 660 : 440;
      o.start();
      o.stop(audio.currentTime + 0.16);
      o.onended = () => void audio.close();
    }
    lastVersion.current = game.version;
  }, [game, sound, volume]);
  async function enter(create: boolean, view = false) {
    await act(async () => {
      const u = await identity();
      setUid(u.id);
      const id = await rpc<string>(
        create ? "create_room" : "join_room",
        create ? { nickname } : { code, nickname, screen: view },
      );
      router.push(`/sala/${id}${view ? "?telao=1" : ""}`);
    });
  }
  async function cmd(command: string, payload: Record<string, unknown> = {}) {
    if (!game) return;
    await act(() =>
      rpc("game_command", {
        room: roomId,
        match: game.id,
        expected_version: game.version,
        idempotency_key: crypto.randomUUID(),
        command,
        payload,
      }),
    );
  }
  const filtered = catalog.filter(
    (q) =>
      (!exact || q.word_count === Number(exact)) && cats.includes(q.category),
  );
  const allCats = catalog.length
    ? [...new Set(catalog.map((q) => q.category))]
    : categories;
  return (
    <div
      className={screen ? "app television" : "app"}
      data-ready={uid ? "true" : "false"}
    >
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Arriscaí! Início">
          Arriscaí<span>!</span>
        </Link>
        <span className="tagline">Quanto menos pistas, mais pontos!</span>
        <div className="top-actions">
          {snapshot && (
            <span className="connection">
              {connected ? "Ao vivo" : "Reconectando…"}
            </span>
          )}
          <button
            className="quiet"
            onClick={() => {
              setSound(!sound);
              sessionStorage.setItem("sound", String(!sound));
            }}
          >
            {sound ? "Som ligado" : "Som desligado"}
          </button>
          {sound && (
            <label className="volume">
              Volume
              <input
                aria-label="Volume"
                type="range"
                min="0"
                max="1"
                step=".05"
                value={volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  sessionStorage.setItem("volume", e.target.value);
                }}
              />
            </label>
          )}
          {!screen && (
            <button className="quiet" onClick={() => setAuth(!auth)}>
              {permanent ? "Minha conta" : "Entrar na conta"}
            </button>
          )}
        </div>
      </header>
      {error && (
        <div role="alert" className="error">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      )}
      {auth && !screen && (
        <section className="panel account">
          <button className="quiet close" onClick={() => setAuth(false)}>
            Fechar
          </button>
          <h2>
            {permanent
              ? "Sua conta está conectada"
              : "Suas perguntas, sua conta"}
          </h2>
          <p>
            Jogar não exige cadastro. Use uma conta para guardar perguntas
            próprias.
          </p>
          {!permanent && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                void act(async () => {
                  const db = supabase();
                  const email = String(data.get("email")),
                    password = String(data.get("password"));
                  const method = (
                    e.nativeEvent as SubmitEvent
                  ).submitter?.getAttribute("value");
                  const result =
                    method === "register"
                      ? await db.auth.updateUser({ email, password })
                      : await db.auth.signInWithPassword({ email, password });
                  if (result.error) throw result.error;
                  setError(
                    method === "register"
                      ? "Confira seu e-mail para confirmar a conta."
                      : "Conta conectada.",
                  );
                });
              }}
            >
              <label>
                E-mail
                <input
                  required
                  name="email"
                  type="email"
                  autoComplete="email"
                />
              </label>
              <label>
                Senha
                <input
                  required
                  name="password"
                  type="password"
                  minLength={12}
                  autoComplete="current-password"
                />
              </label>
              <div className="actions">
                <button disabled={busy} value="login">
                  Entrar
                </button>
                <button
                  className="secondary"
                  disabled={busy || !uid}
                  value="register"
                >
                  Criar conta com esta identidade
                </button>
              </div>
              <small>
                Entre na conta antes de entrar em uma sala. O login de outra
                conta muda sua identidade.
              </small>
            </form>
          )}
        </section>
      )}
      {!roomId ? (
        <main>
          <section className="hero">
            <div className="hero-copy">
              <h1>
                Uma palavra.
                <br />
                Um palpite.
                <br />
                Vale arriscar.
              </h1>
              <p>
                Reúna a turma. Revele as pistas.
                <br />
                Quem acerta antes, leva mais pontos.
              </p>
              <form
                className="entry"
                onSubmit={(e) => {
                  e.preventDefault();
                  void enter(false, screen);
                }}
              >
                <label>
                  Como a turma te chama?
                  <input
                    placeholder="Seu apelido"
                    value={nickname}
                    maxLength={24}
                    required
                    onChange={(e) => setNickname(e.target.value)}
                  />
                </label>
                <button
                  className="primary"
                  disabled={screen || busy || !nickname || !configured()}
                  type="button"
                  onClick={() => void enter(true)}
                >
                  Criar uma sala <Icon name="arrow" />
                </button>
                <div className="join">
                  <label>
                    Código da sala
                    <input
                      placeholder="Ex.: A1B2C3D4"
                      value={code}
                      minLength={8}
                      maxLength={8}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                    />
                  </label>
                  <button
                    className="secondary"
                    disabled={
                      busy || !nickname || code.length !== 8 || !configured()
                    }
                  >
                    Entrar
                  </button>
                </div>
              </form>
              {!configured() && (
                <p className="setup-note">
                  O jogo está aguardando a conexão com o Supabase. As instruções
                  estão no README do projeto.
                </p>
              )}
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit" />
              <span className="floating-star">
                <Icon name="star" />
              </span>
              <div className="question-block">?</div>
              <div className="point-token">
                22<span>pontos</span>
              </div>
              <div className="mini-tile">1</div>
              <span className="art-caption">
                O próximo palpite pode ser o seu.
              </span>
            </div>
          </section>
          <section className="how">
            <h2>
              Todo mundo sabe jogar.
              <br />
              Ninguém sabe a resposta.
            </h2>
            <ol>
              <li>
                <strong>Escolha uma posição</strong>
                <span>O organizador confirma e revela a palavra.</span>
              </li>
              <li>
                <strong>Junte as pistas</strong>
                <span>Arrisque uma resposta ou passe a vez.</span>
              </li>
              <li>
                <strong>Some os pontos</strong>
                <span>Menos palavras abertas, mais pontos para você.</span>
              </li>
            </ol>
          </section>
        </main>
      ) : !snapshot ? (
        <main className="loading">
          <h1>Conectando à sala</h1>
          <p>Use o código do convite para entrar com sua identidade.</p>
          <Link href="/">Voltar ao início</Link>
        </main>
      ) : (
        <main>
          <div className="room-heading">
            <div>
              <p className="room-code">
                Sala <strong>{snapshot.code}</strong>
              </p>
              <h1>
                {active
                  ? screen
                    ? "Hora de arriscar!"
                    : host
                      ? "Você comanda o jogo."
                      : "Sua próxima pista está aqui."
                  : "Junte a turma."}
              </h1>
            </div>
            <div className="actions">
              <button
                className="secondary"
                onClick={() =>
                  void act(() =>
                    navigator.clipboard.writeText(
                      `${location.origin}/?codigo=${snapshot.code}`,
                    ),
                  )
                }
              >
                Copiar convite
              </button>
              <button
                className="secondary"
                onClick={() =>
                  void act(() => navigator.clipboard.writeText(snapshot.code))
                }
              >
                Copiar código
              </button>
              {!screen && (
                <a
                  className="button secondary"
                  href={`/?codigo=${snapshot.code}&telao=1`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir telão
                </a>
              )}
            </div>
          </div>
          {active && game ? (
            <div className={host ? "game-layout" : "public-layout"}>
              <div>
                <Board
                  game={game}
                  host={host}
                  busy={busy}
                  onSelect={(p) => void cmd("select", { position: p })}
                />
                {host && (
                  <section className="panel controls">
                    <h2>
                      {game.paused
                        ? "Partida pausada"
                        : game.phase === "pending_confirmation"
                          ? `Revelar posição ${(game.selected ?? 0) + 1}?`
                          : game.phase === "awaiting_guess"
                            ? "Qual foi o palpite?"
                            : game.phase === "result"
                              ? "A rodada terminou."
                              : "Escolha uma posição no tabuleiro"}
                    </h2>
                    {game.paused ? (
                      <button
                        disabled={busy}
                        onClick={() => void cmd("resume")}
                      >
                        Retomar partida
                      </button>
                    ) : (
                      <>
                        {game.phase === "pending_confirmation" && (
                          <div className="actions">
                            <button
                              disabled={busy}
                              onClick={() => void cmd("reveal")}
                            >
                              Confirmar revelação
                            </button>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => void cmd("cancel_selection")}
                            >
                              Cancelar seleção
                            </button>
                          </div>
                        )}
                        {game.phase === "awaiting_guess" && (
                          <>
                            <form
                              className="guess-form"
                              onSubmit={(e) => {
                                e.preventDefault();
                                void cmd("guess", { text: guess });
                              }}
                            >
                              <label>
                                Palpite de{" "}
                                {game.players[game.current]?.nickname}
                                <input
                                  required
                                  maxLength={200}
                                  value={guess}
                                  onChange={(e) => setGuess(e.target.value)}
                                  placeholder="Digite a resposta que ouviu"
                                />
                              </label>
                              <button disabled={busy || !guess.trim()}>
                                Comparar palpite
                              </button>
                            </form>
                            {secret?.guess && (
                              <div className="judgement">
                                <p>“{secret.guess}”</p>
                                <p>
                                  {secret.suggested
                                    ? "A comparação sugere acerto."
                                    : "A comparação sugere erro."}{" "}
                                  A decisão é sua.
                                </p>
                                <div className="actions">
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      void cmd("judge", { correct: true })
                                    }
                                  >
                                    Confirmar acerto
                                  </button>
                                  <button
                                    className="danger"
                                    disabled={busy}
                                    onClick={() =>
                                      void cmd("judge", { correct: false })
                                    }
                                  >
                                    Confirmar erro
                                  </button>
                                </div>
                              </div>
                            )}
                            <div className="actions">
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() => void cmd("pass")}
                              >
                                Jogador desistiu
                              </button>
                              <button
                                className="quiet"
                                disabled={busy || Boolean(secret?.guess)}
                                onClick={() => void cmd("undo")}
                              >
                                Desfazer revelação
                              </button>
                            </div>
                          </>
                        )}
                        {game.phase === "result" && (
                          <>
                            <p>
                              {game.result
                                ? "Pontos registrados."
                                : "Dessa vez ninguém pontuou."}{" "}
                              Confira a pergunta completa antes de continuar.
                            </p>
                            <div className="actions">
                              <button
                                disabled={busy}
                                onClick={() => void cmd("next")}
                              >
                                Avançar rodada / encerrar
                              </button>
                              {game.round + 1 >= game.prepared && (
                                <button
                                  className="secondary"
                                  disabled={busy}
                                  onClick={() => void cmd("reserve")}
                                >
                                  Preparar pergunta extra inédita
                                </button>
                              )}
                            </div>
                            {game.round + 1 >= game.prepared && permanent && (
                              <details className="custom-form">
                                <summary>
                                  Criar pergunta para o desempate
                                </summary>
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    const data = new FormData(e.currentTarget);
                                    void cmd("reserve_custom", {
                                      question: String(data.get("question")),
                                      answer: String(data.get("answer")),
                                    });
                                  }}
                                >
                                  <p>
                                    Prepare antes de abrir a rodada extra. A
                                    pergunta não poderá ser alterada depois.
                                  </p>
                                  <label>
                                    Pergunta inédita, até 22 palavras
                                    <textarea
                                      required
                                      name="question"
                                      maxLength={1500}
                                    />
                                  </label>
                                  <label>
                                    Resposta da pergunta extra
                                    <input
                                      required
                                      name="answer"
                                      maxLength={200}
                                    />
                                  </label>
                                  <button disabled={busy}>
                                    Preparar pergunta própria extra
                                  </button>
                                </form>
                              </details>
                            )}
                          </>
                        )}
                        {game.phase === "awaiting_position" && (
                          <button
                            className="secondary"
                            disabled={
                              busy ||
                              snapshot.members.some(
                                (m) =>
                                  m.user_id ===
                                    game.players[game.current]?.id &&
                                  now - Date.parse(m.last_seen) < 45000,
                              )
                            }
                            onClick={() => void cmd("skip")}
                          >
                            Pular jogador desconectado
                          </button>
                        )}
                      </>
                    )}
                  </section>
                )}
                {host && (
                  <details className="panel management">
                    <summary>Controles da partida</summary>
                    <div className="actions">
                      <button
                        className="secondary"
                        disabled={busy || game.paused}
                        onClick={() => void cmd("pause")}
                      >
                        Pausar
                      </button>
                      <label>
                        Rodadas programadas
                        <input
                          aria-label="Ajustar rodadas"
                          type="number"
                          min={game.round + 1}
                          max={game.prepared}
                          defaultValue={game.planned}
                          onBlur={(e) => {
                            if (Number(e.target.value) !== game.planned)
                              void cmd("adjust", {
                                rounds: Number(e.target.value),
                              });
                          }}
                        />
                      </label>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              "Cancelar esta partida sem declarar vencedor?",
                            )
                          )
                            void cmd("cancel");
                        }}
                      >
                        Cancelar partida
                      </button>
                    </div>
                  </details>
                )}
              </div>
              <aside>
                <Scoreboard game={game} />
                {host && secret && (
                  <section className="panel private">
                    <div className="private-heading">Só você vê</div>
                    <h2>Pergunta do organizador</h2>
                    <p>{secret.question}?</p>
                    <span>Resposta</span>
                    <strong>{secret.answer}</strong>
                    {secret.aliases?.length > 0 && (
                      <small>Também aceito: {secret.aliases.join(", ")}</small>
                    )}
                  </section>
                )}
                {!host && (
                  <p className="spectator-note">
                    {screen
                      ? "Telão · somente leitura"
                      : game.players.some((p) => p.id === uid)
                        ? "Peça a posição e dê seu palpite ao organizador."
                        : "Você está assistindo. Entre no rodízio na próxima partida."}
                  </p>
                )}
              </aside>
            </div>
          ) : (
            <>
              {game?.status === "completed" && (
                <section className="podium">
                  <Icon name="trophy" />
                  <p>Essa foi de</p>
                  <h2>
                    {game.players.find((p) => p.id === game.winner)?.nickname}!
                  </h2>
                  <p>Uma boa dose de coragem. Um lugar no topo.</p>
                  <Scoreboard game={game} />
                </section>
              )}
              <div className="lobby-layout">
                <section className="panel members">
                  <h2>A turma está chegando</h2>
                  <p>
                    Compartilhe o código <strong>{snapshot.code}</strong>. Quem
                    organiza conduz as pistas e não disputa pontos.
                  </p>
                  <ul>
                    {snapshot.members.map((m) => (
                      <li key={m.user_id}>
                        <span className="avatar">
                          {m.nickname.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <strong>
                            {m.nickname}
                            {m.user_id === uid ? " (você)" : ""}
                          </strong>
                          <small>
                            {m.user_id === snapshot.host_id
                              ? "Organizador"
                              : m.spectator
                                ? "Espectador"
                                : "Jogador"}
                          </small>
                        </div>
                        <span className="presence">
                          {online.includes(m.user_id) ? "Online" : "Ausente"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {host && (
                    <>
                      <h3>Quem vai organizar?</h3>
                      <div className="actions">
                        <select
                          aria-label="Escolher organizador"
                          value={snapshot.host_id}
                          onChange={(e) =>
                            void act(() =>
                              rpc("choose_host", {
                                room: roomId,
                                member: e.target.value,
                              }),
                            )
                          }
                        >
                          {snapshot.members
                            .filter((m) => !m.spectator)
                            .map((m) => (
                              <option key={m.user_id} value={m.user_id}>
                                {m.nickname}
                              </option>
                            ))}
                        </select>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            void act(() => rpc("choose_host", { room: roomId }))
                          }
                        >
                          Sortear organizador
                        </button>
                      </div>
                    </>
                  )}
                  {!host && (
                    <p>
                      O organizador está preparando a próxima partida. Ela
                      aparecerá aqui automaticamente.
                    </p>
                  )}
                </section>
                {host && (
                  <section className="panel preparation">
                    <h2>{game ? "Mais uma partida?" : "Prepare a partida"}</h2>
                    <p>Escolha as perguntas antes de abrir o tabuleiro.</p>
                    <div className="fields">
                      <label>
                        Rodadas
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={rounds}
                          onChange={(e) => setRounds(Number(e.target.value))}
                        />
                      </label>
                      <label>
                        Tamanho da pergunta
                        <select
                          value={exact}
                          onChange={(e) => setExact(e.target.value)}
                        >
                          <option value="">Todos os tamanhos</option>
                          {Array.from({ length: 22 }, (_, i) => (
                            <option key={i} value={i + 1}>
                              {i + 1} palavras
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <fieldset>
                      <legend>Categorias</legend>
                      <div className="category-list">
                        {allCats.map((c) => (
                          <label key={c}>
                            <input
                              type="checkbox"
                              checked={cats.includes(c)}
                              onChange={(e) =>
                                setCats(
                                  e.target.checked
                                    ? [...cats, c]
                                    : cats.filter((x) => x !== c),
                                )
                              }
                            />
                            {c}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label>
                      Seleção
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                      >
                        <option value="automatic">Automática</option>
                        <option value="manual">Manual</option>
                        <option value="mixed">Mista</option>
                      </select>
                    </label>
                    {mode !== "automatic" && (
                      <div className="question-list">
                        {filtered.map((q) => (
                          <label key={q.id}>
                            <input
                              type="checkbox"
                              checked={chosen.includes(q.id)}
                              onChange={(e) =>
                                setChosen(
                                  e.target.checked
                                    ? [...chosen, q.id]
                                    : chosen.filter((x) => x !== q.id),
                                )
                              }
                            />
                            {q.question}? <small>{q.word_count} palavras</small>
                            {q.own && (
                              <button
                                className="quiet"
                                type="button"
                                onClick={() =>
                                  void act(async () => {
                                    const data = await rpc<
                                      Secret & { category: string }
                                    >("own_question_snapshot", {
                                      room: roomId,
                                      question_id: q.id,
                                    });
                                    setEditSecret(data);
                                    setEditId(q.id);
                                    setCustom(true);
                                  })
                                }
                              >
                                Editar
                              </button>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                    <p
                      className={filtered.length < rounds ? "insufficient" : ""}
                    >
                      {filtered.length} perguntas disponíveis.{" "}
                      {filtered.length < rounds
                        ? "Amplie os filtros ou reduza as rodadas."
                        : "Até 5 perguntas adicionais ficam reservadas para desempate."}
                    </p>
                    <div className="actions">
                      <button
                        disabled={
                          busy ||
                          filtered.length < rounds ||
                          !cats.length ||
                          (mode === "manual" && chosen.length < rounds) ||
                          snapshot.members.filter(
                            (m) => m.user_id !== uid && !m.spectator,
                          ).length < 1
                        }
                        onClick={() =>
                          void act(() =>
                            rpc("prepare_match", {
                              room: roomId,
                              planned: rounds,
                              categories: cats,
                              exact_words: exact ? Number(exact) : null,
                              selected: mode === "automatic" ? [] : chosen,
                              selection_mode: mode,
                            }),
                          )
                        }
                      >
                        {busy
                          ? "Preparando…"
                          : game
                            ? "Iniciar nova partida"
                            : "Preparar e iniciar"}
                      </button>
                      <button
                        className="secondary"
                        disabled={!permanent}
                        onClick={() => {
                          setEditId(null);
                          setEditSecret(null);
                          setCustom(!custom);
                        }}
                      >
                        Criar pergunta
                      </button>
                    </div>
                    {!permanent && (
                      <small>
                        Entre em uma conta permanente para usar perguntas
                        próprias.
                      </small>
                    )}
                    {custom && (
                      <form
                        className="custom-form"
                        key={editId}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const data = new FormData(e.currentTarget);
                          void act(async () => {
                            await rpc("save_question", {
                              room: roomId,
                              question_id: editId,
                              question: String(data.get("question")),
                              answer: String(data.get("answer")),
                              category: String(data.get("category")),
                              aliases: String(data.get("aliases"))
                                .split(";")
                                .map((x) => x.trim())
                                .filter(Boolean),
                            });
                            setCatalog(
                              await rpc<Catalog[]>("question_catalog", {
                                room: roomId,
                              }),
                            );
                            setCustom(false);
                          });
                        }}
                      >
                        <h3>{editId ? "Editar pergunta" : "Sua pergunta"}</h3>
                        <label>
                          Pergunta (até 22 palavras)
                          <textarea
                            name="question"
                            required
                            maxLength={1500}
                            defaultValue={
                              catalog.find((q) => q.id === editId)?.question
                            }
                          />
                        </label>
                        <label>
                          Resposta
                          <input
                            name="answer"
                            required
                            maxLength={200}
                            defaultValue={editSecret?.answer}
                          />
                        </label>
                        <label>
                          Outras respostas aceitas, separadas por ;
                          <input
                            name="aliases"
                            maxLength={1000}
                            defaultValue={editSecret?.aliases.join("; ")}
                          />
                        </label>
                        <label>
                          Categoria
                          <select
                            name="category"
                            defaultValue={editSecret?.category}
                          >
                            {allCats.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </label>
                        <button disabled={busy}>Salvar pergunta</button>
                      </form>
                    )}
                  </section>
                )}
              </div>
              {snapshot.history.length > 0 && (
                <section className="panel history">
                  <h2>Já rolou por aqui</h2>
                  {snapshot.history.map((h) => (
                    <div key={h.id}>
                      <span>
                        {new Date(h.ended_at).toLocaleString("pt-BR")}
                      </span>
                      <strong>
                        {[...h.scores]
                          .sort((a, b) => b.score - a.score)
                          .map((p) => `${p.nickname}: ${p.score}`)
                          .join(" · ")}
                      </strong>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </main>
      )}
      <footer>
        Arriscaí! <span>Quanto menos pistas, mais pontos!</span>
      </footer>
    </div>
  );
}
function Board({
  game: g,
  host,
  busy,
  onSelect,
}: {
  game: Game;
  host: boolean;
  busy: boolean;
  onSelect: (p: number) => void;
}) {
  const revealed = g.words.filter((x) => x !== null).length;
  return (
    <section className="board-shell">
      <div className="board-top">
        <div>
          <span>
            Rodada {g.round + 1}
            {g.round >= g.planned ? " · Desempate" : ` de ${g.planned}`}
          </span>
          <h2>
            {g.phase === "result"
              ? "Pergunta revelada"
              : `É a vez de ${g.players[g.current]?.nickname}`}
          </h2>
        </div>
        <div className="points">
          <strong>
            {Math.max(
              1,
              g.words.length -
                revealed +
                (g.phase === "awaiting_guess" ? 1 : 0),
            )}
          </strong>
          <span>pontos em jogo</span>
        </div>
      </div>
      <div className="board-category">
        {g.category}
        <span>
          {revealed} de {g.words.length} palavras
        </span>
      </div>
      <div className="board">
        {g.words.map((word, i) => (
          <button
            key={i}
            className={`tile ${word ? "revealed" : ""} ${g.selected === i ? "selected" : ""}`}
            aria-label={word ? `Posição ${i + 1}: ${word}` : `Posição ${i + 1}`}
            disabled={
              busy ||
              !host ||
              g.paused ||
              g.phase !== "awaiting_position" ||
              word !== null
            }
            onClick={() => onSelect(i)}
          >
            <span className="tile-index">{i + 1}</span>
            {word && (
              <strong>
                {word}
                {i === g.words.length - 1 ? "?" : ""}
              </strong>
            )}
          </button>
        ))}
      </div>
      {g.phase === "pending_confirmation" && (
        <p className="board-hint">
          Posição {(g.selected ?? 0) + 1} selecionada. Aguardando confirmação.
        </p>
      )}
      {g.paused && (
        <p className="pause-banner" role="status">
          Partida pausada. O organizador precisa retomar.
        </p>
      )}
    </section>
  );
}
function Scoreboard({ game }: { game: Game }) {
  return (
    <section className="panel scoreboard">
      <h2>Placar</h2>
      <ol>
        {[...game.players]
          .sort((a, b) => b.score - a.score)
          .map((p, i) => (
            <li
              key={p.id}
              className={
                game.players[game.current]?.id === p.id ? "current" : ""
              }
            >
              <span>{i + 1}</span>
              <strong>{p.nickname}</strong>
              <b>
                {p.score}
                <small>pts</small>
              </b>
            </li>
          ))}
      </ol>
    </section>
  );
}
