"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { configured, identity, rpc, supabase } from "@/lib/supabase";
import {
  humanError,
  type Game,
  type Member,
  type Secret,
  type Snapshot,
} from "@/lib/game";

type Catalog = {
  id: string;
  category: string;
  question: string;
  word_count: number;
  own: boolean;
};

type QuestionPreview = Secret & {
  id: string;
  category: string;
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

const categoryMeta: Record<string, { hint: string; icon: string }> = {
  "Conhecimentos gerais": { hint: "De tudo um pouco", icon: "bulb" },
  "Filmes e séries": { hint: "Telonas e maratonas", icon: "clapper" },
  Música: { hint: "Ritmos, bandas e hits", icon: "music" },
  Esportes: { hint: "Recordes e campeões", icon: "ball" },
  Geografia: { hint: "Mapas e lugares", icon: "globe" },
  História: { hint: "Fatias do tempo", icon: "column" },
  "Ciência e tecnologia": { hint: "Descobertas e futuro", icon: "atom" },
  "Cultura pop": { hint: "Games, heróis e redes", icon: "gamepad" },
};

const wheelPalette = [
  "#FFBE3B",
  "#27A5F9",
  "#1BBC91",
  "#FFD875",
  "#4D94FF",
  "#FF8B6A",
  "#68D6B9",
  "#FFA630",
];

type SoundKind = "reveal" | "error" | "correct" | "roulette" | "victory";

function playEventSound(kind: SoundKind, enabled: boolean, volume: number) {
  if (!enabled || volume <= 0 || typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    // Still allow opt-in sound if user turned it on, but keep gentle envelope
  }
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const patterns: Record<
      SoundKind,
      { freq: number; dur: number; delay: number; type: OscillatorType }[]
    > = {
      reveal: [
        { freq: 440, dur: 0.1, delay: 0, type: "triangle" },
        { freq: 660, dur: 0.14, delay: 0.08, type: "triangle" },
      ],
      error: [
        { freq: 260, dur: 0.14, delay: 0, type: "sawtooth" },
        { freq: 185, dur: 0.2, delay: 0.11, type: "sawtooth" },
      ],
      correct: [
        { freq: 523.25, dur: 0.12, delay: 0, type: "sine" },
        { freq: 659.25, dur: 0.14, delay: 0.09, type: "sine" },
        { freq: 783.99, dur: 0.22, delay: 0.18, type: "sine" },
      ],
      roulette: [
        { freq: 330, dur: 0.07, delay: 0, type: "triangle" },
        { freq: 392, dur: 0.07, delay: 0.08, type: "triangle" },
        { freq: 493.88, dur: 0.09, delay: 0.16, type: "triangle" },
        { freq: 587.33, dur: 0.15, delay: 0.25, type: "sine" },
      ],
      victory: [
        { freq: 523.25, dur: 0.12, delay: 0, type: "triangle" },
        { freq: 659.25, dur: 0.12, delay: 0.1, type: "triangle" },
        { freq: 783.99, dur: 0.14, delay: 0.2, type: "triangle" },
        { freq: 1046.5, dur: 0.3, delay: 0.32, type: "sine" },
      ],
    };
    const notes = patterns[kind];
    notes.forEach((n, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type;
      osc.frequency.setValueAtTime(n.freq, now + n.delay);
      gain.gain.setValueAtTime(0.0001, now + n.delay);
      gain.gain.linearRampToValueAtTime(
        Math.min(0.35, volume * 0.22),
        now + n.delay + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + n.delay + n.dur + 0.02,
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.delay);
      osc.stop(now + n.delay + n.dur + 0.03);
      if (idx === notes.length - 1) {
        osc.onended = () => void ctx.close().catch(() => {});
      }
    });
  } catch {
    // Ignore audio context restrictions if blocked by browser policy
  }
}

function Icon({
  name,
}: {
  name:
    | "star"
    | "trophy"
    | "arrow"
    | "crown"
    | "wheel"
    | "fullscreen"
    | "bulb"
    | "clapper"
    | "music"
    | "ball"
    | "globe"
    | "column"
    | "atom"
    | "gamepad";
}) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "star" ? (
        <path
          fill="#FFBE3B"
          stroke="#102E53"
          d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"
        />
      ) : name === "trophy" ? (
        <>
          <path
            fill="#FFBE3B"
            stroke="#102E53"
            d="M7 3h10v7a5 5 0 0 1-10 0V3Z"
          />
          <path
            stroke="#102E53"
            d="M12 15v6m-4 0h8M7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4"
          />
        </>
      ) : name === "crown" ? (
        <path
          fill="#FFBE3B"
          stroke="#102E53"
          d="m2 18 2-11 5 4 3-6 3 6 5-4 2 11H2Z"
        />
      ) : name === "wheel" ? (
        <>
          <circle cx="12" cy="12" r="9" fill="#FFBE3B" stroke="#102E53" />
          <circle cx="12" cy="12" r="2.5" fill="#fff" stroke="#102E53" />
          <path stroke="#102E53" d="M12 3v6.5M12 14.5V21M3 12h6.5M14.5 12H21" />
        </>
      ) : name === "fullscreen" ? (
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
      ) : name === "bulb" ? (
        <path
          fill="#FFBE3B"
          stroke="#102E53"
          d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.5 1 2.5h6c0-1 .3-1.9 1-2.5A6 6 0 0 0 12 3Z"
        />
      ) : name === "clapper" ? (
        <>
          <rect
            x="3"
            y="8"
            width="18"
            height="13"
            rx="2"
            fill="#FFBE3B"
            stroke="#102E53"
          />
          <path stroke="#102E53" d="M3 8 6 3h13l2 5M8 3l2 5m4-5 2 5" />
        </>
      ) : name === "music" ? (
        <>
          <path stroke="#102E53" d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" fill="#FFBE3B" stroke="#102E53" />
          <circle cx="18" cy="16" r="3" fill="#FFBE3B" stroke="#102E53" />
        </>
      ) : name === "ball" ? (
        <>
          <circle cx="12" cy="12" r="9" fill="#FFBE3B" stroke="#102E53" />
          <path stroke="#102E53" d="M4.5 9.5c5 0 10 0 15 0M4.5 14.5h15M12 3v18" />
        </>
      ) : name === "globe" ? (
        <>
          <circle cx="12" cy="12" r="9" fill="#68D6B9" stroke="#102E53" />
          <path stroke="#102E53" d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </>
      ) : name === "column" ? (
        <>
          <path
            fill="#FFBE3B"
            stroke="#102E53"
            d="M4 6h16v3H4zM4 18h16v3H4z"
          />
          <path stroke="#102E53" d="M7 9v9m5-9v9m5-9v9" />
        </>
      ) : name === "atom" ? (
        <>
          <circle cx="12" cy="12" r="2.5" fill="#FFBE3B" stroke="#102E53" />
          <ellipse
            cx="12"
            cy="12"
            rx="9"
            ry="4"
            transform="rotate(30 12 12)"
            stroke="#102E53"
          />
          <ellipse
            cx="12"
            cy="12"
            rx="9"
            ry="4"
            transform="rotate(-30 12 12)"
            stroke="#102E53"
          />
        </>
      ) : name === "gamepad" ? (
        <>
          <rect
            x="2"
            y="6"
            width="20"
            height="12"
            rx="5"
            fill="#FFBE3B"
            stroke="#102E53"
          />
          <path stroke="#102E53" d="M6 12h4m-2-2v4m7-1h.01M18 11h.01" />
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
  const [userEmail, setUserEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [permanent, setPermanent] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [busy, setBusy] = useState(false);
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [auth, setAuth] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [previewMap, setPreviewMap] = useState<Record<string, QuestionPreview>>(
    {},
  );
  const [guess, setGuess] = useState("");
  const [custom, setCustom] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editSecret, setEditSecret] = useState<
    (Secret & { category: string }) | null
  >(null);
  const [scoresExpanded, setScoresExpanded] = useState(false);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelBanner, setWheelBanner] = useState("");
  const lastRouletteId = useRef<string | null>(null);
  const prevGameRef = useRef<Game | null>(null);
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
    if (user) {
      setUserEmail(user.email ?? "");
      setEmailConfirmed(Boolean(user.email_confirmed_at || user.confirmed_at));
    }
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
      setError(humanError(e));
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
          setUserEmail(u.email ?? "");
          setEmailConfirmed(Boolean(u.email_confirmed_at || u.confirmed_at));
        }
      })
      .catch((e) => setError(humanError(e)));
    const {
      data: { subscription },
    } = supabase().auth.onAuthStateChange((event, session) => {
      if (alive && session) {
        setUid(session.user.id);
        setPermanent(!session.user.is_anonymous);
        setUserEmail(session.user.email ?? "");
        setEmailConfirmed(
          Boolean(session.user.email_confirmed_at || session.user.confirmed_at),
        );
        if (event === "PASSWORD_RECOVERY") {
          setAuth(true);
          setRecoveryMode(true);
          setNotice("Defina sua nova senha abaixo.");
        }
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
        if (alive) setError(humanError(e));
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

  // Synchronized Roulette animation & announcement across all clients
  useEffect(() => {
    if (!snapshot?.roulette) return;
    const r = snapshot.roulette;
    if (lastRouletteId.current === null) {
      lastRouletteId.current = r.id;
      return;
    }
    if (lastRouletteId.current !== r.id) {
      lastRouletteId.current = r.id;
      const eligible = snapshot.members.filter(
        (m) => !m.spectator && !m.display_only,
      );
      const idx = Math.max(
        0,
        eligible.findIndex((m) => m.user_id === r.winner_id),
      );
      const count = Math.max(1, eligible.length);
      if (r.mode === "roulette") {
        setWheelSpinning(true);
        playEventSound("roulette", sound, volume);
        const sliceDeg = 360 / count;
        const targetDeg = (360 - ((idx + 0.5) * sliceDeg) % 360) % 360;
        setWheelAngle((prev) => {
          const currentMod = ((prev % 360) + 360) % 360;
          const diff = (targetDeg - currentMod + 360) % 360;
          return prev + 1440 + diff;
        });
        const reduced =
          typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        const timer = setTimeout(
          () => {
            setWheelSpinning(false);
            setWheelBanner(
              `${r.winner_nickname} foi sorteado(a) na roleta para organizar!`,
            );
            setLiveAnnouncement(
              `Roleta concluída: ${r.winner_nickname} vai organizar a partida.`,
            );
          },
          reduced ? 50 : 2100,
        );
        return () => clearTimeout(timer);
      } else {
        setWheelBanner(`${r.winner_nickname} assumiu a organização da sala.`);
        setLiveAnnouncement(
          `${r.winner_nickname} assumiu a organização da sala.`,
        );
      }
    }
  }, [snapshot?.roulette, snapshot?.members, sound, volume]);

  useEffect(() => {
    if (!host || active || !roomId) return;
    rpc<Catalog[]>("question_catalog", { room: roomId })
      .then((q) => {
        setCatalog(q);
        setCats((prev) =>
          prev.length ? prev : [...new Set(q.map((x) => x.category))],
        );
      })
      .catch((e) => setError(humanError(e)));
  }, [host, active, roomId]);

  // Distinct event sounds + aria-live announcements on game transitions
  useEffect(() => {
    if (!game) {
      prevGameRef.current = null;
      return;
    }
    const prev = prevGameRef.current;
    if (prev && prev.id === game.id && game.version > prev.version) {
      if (game.status === "completed" && prev.status !== "completed") {
        playEventSound("victory", sound, volume);
        const w = game.players.find((p) => p.id === game.winner)?.nickname;
        setLiveAnnouncement(
          `Partida encerrada! ${w ?? "Campeão"} venceu a partida!`,
        );
      } else if (game.phase === "result" && prev.phase !== "result") {
        if (game.result) {
          playEventSound("correct", sound, volume);
          const w = game.players.find((p) => p.id === game.result)?.nickname;
          setLiveAnnouncement(
            `${w ?? "Jogador"} acertou a resposta ${game.answer ?? ""} e ganhou ${game.round_points ?? 0} pontos!`,
          );
        } else {
          playEventSound("error", sound, volume);
          setLiveAnnouncement(
            `Rodada encerrada sem vencedor. A resposta era ${game.answer ?? ""}.`,
          );
        }
      } else if (
        game.phase === "awaiting_guess" &&
        prev.phase === "pending_confirmation"
      ) {
        playEventSound("reveal", sound, volume);
        const pos = (game.last ?? 0) + 1;
        const word = game.words[game.last ?? 0] ?? "";
        setLiveAnnouncement(
          `Posição ${pos} revelada: ${word}. Vez de ${game.players[game.current]?.nickname}.`,
        );
      } else if (
        game.phase === "awaiting_position" &&
        prev.phase === "awaiting_guess"
      ) {
        playEventSound("error", sound, volume);
        setLiveAnnouncement(
          `Vez passada. Agora é a vez de ${game.players[game.current]?.nickname}.`,
        );
      } else if (
        game.phase === "awaiting_position" &&
        prev.phase === "result"
      ) {
        setLiveAnnouncement(
          `Nova rodada ${game.round + 1} iniciada. Começa com ${game.players[game.current]?.nickname}.`,
        );
      }
    }
    prevGameRef.current = game;
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
    await act(async () => {
      await rpc("game_command", {
        room: roomId,
        match: game.id,
        expected_version: game.version,
        idempotency_key: crypto.randomUUID(),
        command,
        payload,
      });
      if (command === "judge" || command === "pass" || command === "next") {
        setGuess("");
      }
    });
  }

  const allCats = useMemo(
    () =>
      catalog.length
        ? [...new Set(catalog.map((q) => q.category))]
        : categories,
    [catalog],
  );

  const filtered = useMemo(() => {
    const qNorm = searchQuery.trim().toLocaleLowerCase("pt-BR");
    return catalog.filter(
      (q) =>
        (!exact || q.word_count === Number(exact)) &&
        cats.includes(q.category) &&
        (!qNorm ||
          q.question.toLocaleLowerCase("pt-BR").includes(qNorm) ||
          q.category.toLocaleLowerCase("pt-BR").includes(qNorm) ||
          previewMap[q.id]?.answer?.toLocaleLowerCase("pt-BR").includes(qNorm)),
    );
  }, [catalog, exact, cats, searchQuery, previewMap]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, { total: number; w22: number }> = {};
    for (const c of allCats) counts[c] = { total: 0, w22: 0 };
    for (const q of catalog) {
      if (!counts[q.category]) counts[q.category] = { total: 0, w22: 0 };
      counts[q.category].total += 1;
      if (q.word_count === 22) counts[q.category].w22 += 1;
    }
    return counts;
  }, [catalog, allCats]);

  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedQuestions = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const eligibleMembers = useMemo(
    () =>
      snapshot?.members.filter((m) => !m.spectator && !m.display_only) ?? [],
    [snapshot?.members],
  );

  const reserveCount = Math.max(0, Math.min(5, filtered.length - rounds));

  function toggleFullscreen() {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  }

  return (
    <div
      className={screen ? "app television" : "app"}
      data-ready={uid ? "true" : "false"}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {!screen ? (
        <header className="topbar">
          <Link className="brand" href="/" aria-label="Arriscaí! Início">
            <span className="brand-badge" aria-hidden="true">
              ?
            </span>
            Arriscaí<span>!</span>
          </Link>
          <span className="tagline">Quanto menos pistas, mais pontos!</span>
          <div className="top-actions">
            {snapshot && (
              <span className="connection">
                <span
                  className={`live-dot ${connected ? "online" : "offline"}`}
                  aria-hidden="true"
                />
                {connected ? "Ao vivo" : "Reconectando…"}
              </span>
            )}
            <button
              className="quiet"
              type="button"
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
            <button
              className="quiet"
              type="button"
              onClick={() => {
                setAuth(!auth);
                setRecoveryMode(false);
              }}
            >
              {permanent ? "Minha conta" : "Entrar na conta"}
            </button>
          </div>
        </header>
      ) : (
        <header className="tv-stage-bar">
          <div className="tv-brand">
            <span className="brand-badge" aria-hidden="true">
              ?
            </span>
            <strong>
              Arriscaí<span>!</span>
            </strong>
            <span className="tv-chip">PALCO AO VIVO · 16:9</span>
          </div>
          {snapshot && (
            <div className="tv-room-badge">
              <span>SALA</span>
              <strong>{snapshot.code}</strong>
              <button
                type="button"
                className="quiet tv-fs-btn"
                onClick={toggleFullscreen}
                aria-label="Alternar tela cheia"
                title="Tela cheia"
              >
                <Icon name="fullscreen" /> Tela cheia
              </button>
            </div>
          )}
        </header>
      )}

      {error && (
        <div role="alert" className="error">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Fechar aviso"
          >
            ×
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="notice-banner">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Fechar mensagem"
          >
            ×
          </button>
        </div>
      )}

      {auth && !screen && (
        <section className="panel account">
          <button
            type="button"
            className="quiet close"
            onClick={() => setAuth(false)}
          >
            Fechar
          </button>
          <h2>
            {permanent
              ? "Sua conta está conectada"
              : recoveryMode
                ? "Recuperar senha da conta"
                : "Suas perguntas, sua conta"}
          </h2>
          <p>
            Jogar não exige cadastro. Use uma conta permanente para criar,
            editar e reutilizar perguntas próprias.
          </p>
          {permanent ? (
            <div className="account-status">
              <p>
                <strong>E-mail:</strong> {userEmail || "Conta verificada"}
              </p>
              <p>
                <strong>Status do e-mail:</strong>{" "}
                <span
                  className={`status-pill ${emailConfirmed ? "confirmed" : "pending"}`}
                >
                  {emailConfirmed
                    ? "Confirmado e ativo"
                    : "Aguardando confirmação no seu e-mail"}
                </span>
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setRecoveryMode(!recoveryMode)}
                >
                  {recoveryMode ? "Cancelar troca de senha" : "Alterar senha"}
                </button>
              </div>
              {recoveryMode && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    void act(async () => {
                      const newPassword = String(data.get("new_password"));
                      const { error: err } = await supabase().auth.updateUser({
                        password: newPassword,
                      });
                      if (err) throw err;
                      setNotice("Senha atualizada com sucesso!");
                      setRecoveryMode(false);
                    });
                  }}
                >
                  <label>
                    Nova senha (mínimo 12 caracteres)
                    <input
                      required
                      name="new_password"
                      type="password"
                      minLength={12}
                      autoComplete="new-password"
                    />
                  </label>
                  <button disabled={busy}>Salvar nova senha</button>
                </form>
              )}
            </div>
          ) : recoveryMode ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                void act(async () => {
                  const email = String(data.get("email")).trim();
                  const { error: err } =
                    await supabase().auth.resetPasswordForEmail(email, {
                      redirectTo:
                        typeof window !== "undefined"
                          ? window.location.origin
                          : undefined,
                    });
                  if (err) throw err;
                  setNotice(
                    "Enviamos um link de recuperação para o seu e-mail. Confira a caixa de entrada e o spam.",
                  );
                });
              }}
            >
              <label>
                E-mail cadastrado
                <input
                  required
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                />
              </label>
              <div className="actions">
                <button disabled={busy}>Enviar link de recuperação</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setRecoveryMode(false)}
                >
                  Voltar ao login
                </button>
              </div>
            </form>
          ) : (
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
                  setNotice(
                    method === "register"
                      ? "Cadastro iniciado! Confira seu e-mail para confirmar a conta."
                      : "Conta conectada com sucesso.",
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
                <button
                  type="button"
                  className="quiet"
                  onClick={() => setRecoveryMode(true)}
                >
                  Esqueci minha senha
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
              <span className="hero-kicker">
                ✦ GAME SHOW SOCIAL · ATÉ 22 PALAVRAS
              </span>
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
              <div className="floating-crown">
                <Icon name="crown" />
              </div>
              <div className="question-block">?</div>
              <div className="point-token">
                22<span>pontos</span>
              </div>
              <div className="mini-tile">6</div>
              <div className="hero-live-card">
                <span className="live-pill">PISTA #6 ABERTA</span>
                <strong>“...galo sobre uma bola...”</strong>
                <small>Acertou na 1ª pista: +22 pts!</small>
              </div>
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
              {!screen && (
                <p className="room-code">
                  Sala <strong>{snapshot.code}</strong>
                </p>
              )}
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
            {!screen && (
              <div className="actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() =>
                    void act(async () => {
                      await navigator.clipboard.writeText(
                        `${location.origin}/?codigo=${snapshot.code}`,
                      );
                      setNotice("Link de convite copiado!");
                    })
                  }
                >
                  Copiar convite
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={() =>
                    void act(async () => {
                      await navigator.clipboard.writeText(snapshot.code);
                      setNotice(`Código ${snapshot.code} copiado!`);
                    })
                  }
                >
                  Copiar código
                </button>
                <a
                  className="button secondary"
                  href={`/?codigo=${snapshot.code}&telao=1`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir telão
                </a>
              </div>
            )}
          </div>

          {active && game ? (
            <>
              <CompactScoreStrip
                game={game}
                expanded={scoresExpanded}
                onToggle={() => setScoresExpanded(!scoresExpanded)}
              />
              <div className={host ? "game-layout" : "public-layout"}>
                <div>
                  <Board
                    game={game}
                    host={host}
                    busy={busy}
                    onSelect={(p) => void cmd("select", { position: p })}
                  />

                  {game.phase === "result" && (
                    <RoundResultOverlay
                      game={game}
                      host={host}
                      busy={busy}
                      permanent={permanent}
                      onNext={() => void cmd("next")}
                      onReserve={() => void cmd("reserve")}
                      onReserveCustom={(question, answer) =>
                        void cmd("reserve_custom", { question, answer })
                      }
                    />
                  )}

                  {host && game.phase !== "result" && (
                    <section className="panel controls host-sticky-dock">
                      <div className="dock-header">
                        <h2>
                          {game.paused
                            ? "Partida pausada"
                            : game.phase === "pending_confirmation"
                              ? `Revelar posição ${(game.selected ?? 0) + 1}?`
                              : game.phase === "awaiting_guess"
                                ? "Qual foi o palpite?"
                                : "Escolha uma posição no tabuleiro"}
                        </h2>
                        {secret && (
                          <details className="mobile-secret-peek">
                            <summary>Ver resposta secreta</summary>
                            <div className="peek-box">
                              <p>{secret.question}?</p>
                              <strong>Resposta: {secret.answer}</strong>
                              {secret.aliases?.length > 0 && (
                                <small>
                                  Aceita: {secret.aliases.join(", ")}
                                </small>
                              )}
                            </div>
                          </details>
                        )}
                      </div>

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
                            key={game.planned}
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
                        <small>
                          Também aceito: {secret.aliases.join(", ")}
                        </small>
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
            </>
          ) : (
            <>
              {game?.status === "completed" && <VictoryStage game={game} />}

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
                              : m.display_only
                                ? "Telão (somente leitura)"
                                : m.spectator
                                  ? "Espectador (entra na próxima)"
                                  : "Jogador"}
                          </small>
                        </div>
                        <span className="presence">
                          {online.includes(m.user_id) ? "Online" : "Ausente"}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <HostRoulette
                    members={eligibleMembers}
                    hostId={snapshot.host_id}
                    isHost={host}
                    busy={busy || wheelSpinning}
                    wheelAngle={wheelAngle}
                    wheelSpinning={wheelSpinning}
                    wheelBanner={wheelBanner}
                    onChooseManual={(memberId) =>
                      void act(() =>
                        rpc("choose_host", {
                          room: roomId,
                          member: memberId,
                        }),
                      )
                    }
                    onSpin={() =>
                      void act(() => rpc("choose_host", { room: roomId }))
                    }
                  />

                  {!host && (
                    <p className="lobby-wait-note">
                      O organizador está preparando a próxima partida. Ela
                      aparecerá aqui automaticamente.
                    </p>
                  )}
                </section>

                {host && (
                  <section className="panel preparation">
                    <h2>{game ? "Mais uma partida?" : "Prepare a partida"}</h2>
                    <p>Escolha as perguntas antes de abrir o tabuleiro.</p>

                    {catalog.length === 0 && (
                      <div role="status" className="empty-catalog-banner">
                        <strong>Catálogo oficial sem perguntas liberadas.</strong>
                        <p>
                          Nenhuma pergunta aprovada está disponível no momento.
                          {permanent
                            ? " Crie suas próprias perguntas personalizadas abaixo para iniciar."
                            : " Entre em uma conta permanente para cadastrar perguntas próprias ou aguarde a liberação editorial do catálogo."}
                        </p>
                      </div>
                    )}

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
                          onChange={(e) => {
                            setExact(e.target.value);
                            setPage(1);
                          }}
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
                      <legend>
                        Categorias ({cats.length} de {allCats.length}{" "}
                        selecionadas)
                      </legend>
                      <div className="category-list">
                        {allCats.map((c) => {
                          const meta = categoryMeta[c] ?? {
                            hint: "Perguntas variadas",
                            icon: "bulb",
                          };
                          const stat = categoryCounts[c] ?? {
                            total: 0,
                            w22: 0,
                          };
                          return (
                            <label
                              key={c}
                              className={`cat-card ${cats.includes(c) ? "selected" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={cats.includes(c)}
                                onChange={(e) => {
                                  setCats(
                                    e.target.checked
                                      ? [...cats, c]
                                      : cats.filter((x) => x !== c),
                                  );
                                  setPage(1);
                                }}
                              />
                              <span className="cat-icon-3d" aria-hidden="true">
                                <Icon
                                  name={
                                    meta.icon as Parameters<
                                      typeof Icon
                                    >[0]["name"]
                                  }
                                />
                              </span>
                              <span className="cat-info">
                                <strong>{c}</strong>
                                <small>
                                  {stat.total} itens · {stat.w22} de 22 palavras
                                </small>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>

                    <label>
                      Seleção
                      <select
                        value={mode}
                        onChange={(e) => {
                          setMode(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="automatic">Automática</option>
                        <option value="manual">Manual</option>
                        <option value="mixed">Mista</option>
                      </select>
                    </label>

                    <div className="prep-stats-bar">
                      <span>
                        <strong>{filtered.length}</strong> elegíveis nos filtros
                      </span>
                      <span>
                        <strong>{reserveCount}</strong> extras de reserva
                        (desempate)
                      </span>
                      {mode !== "automatic" && (
                        <span>
                          <strong>{chosen.length}</strong> selecionadas p/{" "}
                          {rounds} rodadas
                        </span>
                      )}
                    </div>

                    {mode !== "automatic" && (
                      <div className="manual-selector">
                        <div className="selector-toolbar">
                          <label className="search-field">
                            Buscar pergunta ou tema
                            <input
                              type="search"
                              placeholder="Digite trecho da pergunta ou categoria..."
                              value={searchQuery}
                              onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                              }}
                            />
                          </label>
                          {chosen.length > 0 && (
                            <button
                              type="button"
                              className="quiet"
                              onClick={() => setChosen([])}
                            >
                              Limpar ({chosen.length})
                            </button>
                          )}
                        </div>

                        <div className="question-list">
                          {pagedQuestions.map((q) => {
                            const prev = previewMap[q.id];
                            const isChecked = chosen.includes(q.id);
                            return (
                              <div
                                key={q.id}
                                className={`question-card ${isChecked ? "chosen" : ""}`}
                              >
                                <label className="question-card-main">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) =>
                                      setChosen(
                                        e.target.checked
                                          ? [...chosen, q.id]
                                          : chosen.filter((x) => x !== q.id),
                                      )
                                    }
                                  />
                                  <div>
                                    <strong>{q.question}?</strong>
                                    <small>
                                      {q.category} · {q.word_count} palavras
                                      {q.own ? " · Autoral" : ""}
                                    </small>
                                    {prev && (
                                      <div className="question-private-preview">
                                        <span>
                                          Resposta privada:{" "}
                                          <strong>{prev.answer}</strong>
                                        </span>
                                        {prev.aliases?.length > 0 && (
                                          <small>
                                            Aliases: {prev.aliases.join(", ")}
                                          </small>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </label>
                                <div className="question-card-actions">
                                  <button
                                    className="quiet"
                                    type="button"
                                    onClick={() =>
                                      void act(async () => {
                                        if (previewMap[q.id]) {
                                          setPreviewMap((m) => {
                                            const copy = { ...m };
                                            delete copy[q.id];
                                            return copy;
                                          });
                                          return;
                                        }
                                        const data =
                                          await rpc<QuestionPreview>(
                                            "host_question_preview",
                                            {
                                              room: roomId,
                                              question_id: q.id,
                                            },
                                          );
                                        setPreviewMap((m) => ({
                                          ...m,
                                          [q.id]: data,
                                        }));
                                      })
                                    }
                                  >
                                    {prev ? "Ocultar resposta" : "Ver resposta"}
                                  </button>
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
                                </div>
                              </div>
                            );
                          })}
                          {pagedQuestions.length === 0 && (
                            <p className="empty-filter-msg">
                              Nenhuma pergunta encontrada para esta busca ou
                              combinação de filtros.
                            </p>
                          )}
                        </div>

                        {totalPages > 1 && (
                          <div className="pagination">
                            <button
                              type="button"
                              className="secondary"
                              disabled={currentPage <= 1}
                              onClick={() =>
                                setPage((p) => Math.max(1, p - 1))
                              }
                            >
                              Anterior
                            </button>
                            <span>
                              Página {currentPage} de {totalPages}
                            </span>
                            <button
                              type="button"
                              className="secondary"
                              disabled={currentPage >= totalPages}
                              onClick={() =>
                                setPage((p) => Math.min(totalPages, p + 1))
                              }
                            >
                              Próxima
                            </button>
                          </div>
                        )}
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
                        type="button"
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
                  {snapshot.history.map((h) => {
                    const sorted = [...h.scores].sort(
                      (a, b) => b.score - a.score,
                    );
                    const champ = h.winner_nickname ?? sorted[0]?.nickname;
                    return (
                      <div key={h.id} className="history-item">
                        <div className="history-meta">
                          <span className="history-champ">
                            <Icon name="trophy" /> Campeão:{" "}
                            <strong>{champ}</strong>
                          </span>
                          <small>
                            Organizador: {h.host_nickname ?? "Organizador"} ·{" "}
                            {h.total_rounds ?? 1}{" "}
                            {(h.total_rounds ?? 1) === 1 ? "rodada" : "rodadas"}{" "}
                            · {new Date(h.ended_at).toLocaleString("pt-BR")}
                          </small>
                        </div>
                        <strong>
                          {sorted
                            .map((p) => `${p.nickname}: ${p.score}`)
                            .join(" · ")}
                        </strong>
                      </div>
                    );
                  })}
                </section>
              )}
            </>
          )}
        </main>
      )}
      {!screen && (
        <footer>
          Arriscaí! <span>Quanto menos pistas, mais pontos!</span>
        </footer>
      )}
    </div>
  );
}

function HostRoulette({
  members,
  hostId,
  isHost,
  busy,
  wheelAngle,
  wheelSpinning,
  wheelBanner,
  onChooseManual,
  onSpin,
}: {
  members: Member[];
  hostId: string;
  isHost: boolean;
  busy: boolean;
  wheelAngle: number;
  wheelSpinning: boolean;
  wheelBanner: string;
  onChooseManual: (memberId: string) => void;
  onSpin: () => void;
}) {
  const n = Math.max(1, members.length);
  const gradient = useMemo(() => {
    if (!members.length) return "#FFBE3B";
    const step = 360 / members.length;
    return `conic-gradient(from 0deg, ${members
      .map(
        (_, i) =>
          `${wheelPalette[i % wheelPalette.length]} ${(i * step).toFixed(1)}deg ${((i + 1) * step).toFixed(1)}deg`,
      )
      .join(", ")})`;
  }, [members]);

  return (
    <div className="roulette-box">
      <h3>Quem vai organizar?</h3>
      <div className="wheel-stage" aria-hidden="true">
        <div className="wheel-pointer" />
        <div
          className={`wheel-disc ${wheelSpinning ? "spinning" : ""}`}
          style={{
            transform: `rotate(${wheelAngle}deg)`,
            background: gradient,
          }}
        >
          {members.map((m, i) => {
            const angle = ((i + 0.5) * 360) / n;
            return (
              <span
                key={m.user_id}
                className="wheel-slice-label"
                style={{
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-68px)`,
                }}
              >
                {m.nickname.slice(0, 10)}
              </span>
            );
          })}
          <span className="wheel-hub">★</span>
        </div>
      </div>

      {wheelBanner && (
        <p className="wheel-announcement" role="status">
          {wheelBanner}
        </p>
      )}

      {isHost && (
        <div className="actions">
          <select
            aria-label="Escolher organizador"
            value={hostId}
            disabled={busy}
            onChange={(e) => onChooseManual(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.nickname}
              </option>
            ))}
          </select>
          <button
            className="secondary"
            type="button"
            disabled={busy || members.length < 1}
            onClick={onSpin}
          >
            <Icon name="wheel" />{" "}
            {wheelSpinning ? "Girando roleta…" : "Sortear organizador"}
          </button>
        </div>
      )}
    </div>
  );
}

function CompactScoreStrip({
  game,
  expanded,
  onToggle,
}: {
  game: Game;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  return (
    <div className="compact-score-bar" aria-label="Resumo do placar">
      <div className="score-chips">
        {sorted.map((p, i) => (
          <span
            key={p.id}
            className={`score-chip ${i === 0 && p.score > 0 ? "leader" : ""} ${game.players[game.current]?.id === p.id ? "turn" : ""}`}
          >
            <strong>{p.nickname}</strong>
            <b>{p.score} pts</b>
          </span>
        ))}
      </div>
      <button
        type="button"
        className="quiet score-toggle-btn"
        onClick={onToggle}
      >
        {expanded ? "Recolher tabela" : "Classificação completa"}
      </button>
      {expanded && (
        <div className="score-drawer">
          <Scoreboard game={game} />
        </div>
      )}
    </div>
  );
}

function RoundResultOverlay({
  game,
  host,
  busy,
  permanent,
  onNext,
  onReserve,
  onReserveCustom,
}: {
  game: Game;
  host: boolean;
  busy: boolean;
  permanent: boolean;
  onNext: () => void;
  onReserve: () => void;
  onReserveCustom: (q: string, a: string) => void;
}) {
  const winner = game.players.find((p) => p.id === game.result);
  const fullQuestion = game.words.filter(Boolean).join(" ") + "?";
  const earned = game.round_points ?? 0;

  return (
    <section
      className="panel round-result-overlay"
      aria-label="Resultado da rodada"
    >
      <div className="result-badge-3d">
        <Icon name={winner ? "trophy" : "star"} />
      </div>
      <span className="result-kicker">
        RODADA {game.round + 1} ENCERRADA
      </span>
      <h2>
        {winner
          ? `${winner.nickname} acertou e levou +${earned} ${earned === 1 ? "ponto" : "pontos"}!`
          : "Ninguém pontuou nesta rodada!"}
      </h2>
      {game.answer && (
        <div className="solution-reveal">
          <span>Resposta correta</span>
          <strong className="solution-answer">{game.answer}</strong>
        </div>
      )}
      <p className="solution-question">{fullQuestion}</p>

      {host && (
        <div className="overlay-host-actions">
          <button disabled={busy} onClick={onNext}>
            Avançar rodada / encerrar
          </button>
          {game.round + 1 >= game.prepared && (
            <button className="secondary" disabled={busy} onClick={onReserve}>
              Preparar pergunta extra inédita
            </button>
          )}
          {game.round + 1 >= game.prepared && permanent && (
            <details className="custom-form">
              <summary>Criar pergunta própria para o desempate</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  onReserveCustom(
                    String(data.get("question")),
                    String(data.get("answer")),
                  );
                }}
              >
                <label>
                  Pergunta inédita, até 22 palavras
                  <textarea required name="question" maxLength={1500} />
                </label>
                <label>
                  Resposta da pergunta extra
                  <input required name="answer" maxLength={200} />
                </label>
                <button disabled={busy}>Preparar pergunta própria extra</button>
              </form>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function VictoryStage({ game }: { game: Game }) {
  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  const champ =
    game.players.find((p) => p.id === game.winner) ?? sorted[0];
  const podiumOrder = [sorted[1], sorted[0], sorted[2]].filter(Boolean);

  return (
    <section className="podium" aria-label="Pódio da partida">
      <div className="podium-crown">
        <Icon name="crown" />
        <Icon name="trophy" />
      </div>
      <span className="podium-kicker">✦ FIM DE JOGO · GRANDE CAMPEÃO ✦</span>
      <p>Essa foi de</p>
      <h2>{champ?.nickname}!</h2>
      <p className="podium-sub">
        Uma boa dose de coragem. Um lugar no topo com{" "}
        <strong>{champ?.score ?? 0} pontos</strong> em {game.round + 1}{" "}
        {game.round + 1 === 1 ? "rodada" : "rodadas"}.
      </p>

      <div className="podium-3d-pedestals">
        {podiumOrder.map((p) => {
          const rank = sorted.findIndex((x) => x.id === p.id) + 1;
          return (
            <div key={p.id} className={`pedestal-col rank-${rank}`}>
              <span className="pedestal-avatar">
                {p.nickname.slice(0, 1).toUpperCase()}
              </span>
              <strong className="pedestal-name">{p.nickname}</strong>
              <span className="pedestal-score">{p.score} pts</span>
              <div className="pedestal-block">{rank}º</div>
            </div>
          );
        })}
      </div>

      <Scoreboard game={game} />
    </section>
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
  const isResult = g.phase === "result";
  const availablePoints = Math.max(
    1,
    g.words.length - revealed + (g.phase === "awaiting_guess" ? 1 : 0),
  );
  const displayPoints = isResult ? (g.round_points ?? 0) : availablePoints;
  const pointsLabel = isResult
    ? g.result
      ? displayPoints === 1
        ? "ponto conquistado"
        : "pontos conquistados"
      : "sem vencedor"
    : availablePoints === 1
      ? "ponto em jogo"
      : "pontos em jogo";

  return (
    <section className="board-shell">
      <div className="board-top">
        <div>
          <span>
            Rodada {g.round + 1}
            {g.round >= g.planned ? " · Desempate" : ` de ${g.planned}`}
          </span>
          <h2>
            {isResult
              ? "Pergunta revelada"
              : `É a vez de ${g.players[g.current]?.nickname}`}
          </h2>
        </div>
        <div className={`points ${isResult ? "points-result" : ""}`}>
          <strong>{displayPoints}</strong>
          <span>{pointsLabel}</span>
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
            type="button"
            className={`tile ${word ? "revealed" : ""} ${g.selected === i ? "selected" : ""} ${g.last === i ? "just-opened" : ""}`}
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
        <p className="board-hint" role="status">
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
