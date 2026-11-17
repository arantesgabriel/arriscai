"use client";
import Link from "next/link";
import { EntryScreen, EntryForm, type EntryMode } from "./game/entry-screen";
import { PublicPreparation } from "./game/preparation-preview";
import { readPreparation, type PreparationPreview } from "@/lib/preparation";
import { Board, Scoreboard } from "./game/board";
import { Icon } from "./game/game-icon";
import { categoryMeta } from "./game/category-metadata";
import { playerColor } from "./game/player-colors";
import { HostRoulette } from "./game/host-roulette";
import { CompactScoreStrip } from "./game/score-strip";
import { RoundResultOverlay, VictoryStage } from "./game/results";
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

export default function GameApp({ roomId }: { roomId?: string }) {
  const router = useRouter();
  const [now, setNow] = useState(0);
  const [uid, setUid] = useState("");
  const [identityStatus, setIdentityStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [userEmail, setUserEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [permanent, setPermanent] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = useCallback((message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(""), 3500);
  }, []);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [busy, setBusy] = useState(false);
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode>("create");
  const [remotePreparation, setRemotePreparation] =
    useState<PreparationPreview | null>(null);
  const [auth, setAuth] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [sound, setSound] = useState(false);
  const [volume, setVolume] = useState(0.25);
  const [online, setOnline] = useState<string[]>([]);
  const [channelHealthy, setChannelHealthy] = useState(false);
  const [restHealthy, setRestHealthy] = useState(false);
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
  const [wheelCountdown, setWheelCountdown] = useState<number | null>(null);
  const [wheelDuration, setWheelDuration] = useState(2100);
  const [wheelBanner, setWheelBanner] = useState("");
  const [wheelMembers, setWheelMembers] = useState<Member[] | null>(null);
  const lastRouletteId = useRef<string | null>(null);
  const rouletteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nicknameInput = useRef<HTMLInputElement>(null);
  const prevGameRef = useRef<Game | null>(null);
  const refreshSequence = useRef(0);
  const locked = useRef(false);
  const presenceChannel = useRef<ReturnType<
    ReturnType<typeof supabase>["channel"]
  > | null>(null);
  const draftRef = useRef<PreparationPreview | null>(null);
  const roomHostRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    roomHostRef.current = snapshot?.host_id;
    const hostId = snapshot?.host_id;
    const presence = presenceChannel.current?.presenceState<{
      preparation?: unknown;
    }>();
    setRemotePreparation(
      hostId
        ? (presence?.[hostId]
            ?.map((meta) => readPreparation(meta.preparation, hostId))
            .find(Boolean) ?? null)
        : null,
    );
  }, [snapshot?.host_id]);

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
      const message = humanError(e);
      setError(message);
      if (message.startsWith("Esse apelido já está em uso"))
        nicknameInput.current?.focus();
      if (roomId) await refresh().catch(() => {});
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  const establishIdentity = useCallback(async () => {
    setIdentityStatus("loading");
    try {
      const u = await identity();
      setUid(u.id);
      setPermanent(!u.is_anonymous);
      setUserEmail(u.email ?? "");
      setEmailConfirmed(Boolean(u.email_confirmed_at || u.confirmed_at));
      setIdentityStatus("ready");
    } catch (e) {
      setIdentityStatus("error");
      setError(humanError(e));
    }
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setCode(query.get("codigo") ?? "");
    if (query.has("codigo") || query.has("telao")) setEntryMode("join");
    setScreen(query.has("telao"));
    setNow(Date.now());
    if (query.has("telao")) setNickname("Telão");
    setSound(sessionStorage.getItem("sound") === "true");
    setVolume(Number(sessionStorage.getItem("volume") ?? 0.25));
    if (!configured()) return;
    let alive = true;
    void establishIdentity();
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
  }, [establishIdentity]);

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
            if (!channel) return;
            const presence = channel.presenceState<{ preparation?: unknown }>();
            setOnline(Object.keys(presence));
            const hostId = roomHostRef.current;
            if (hostId) {
              const preview =
                presence[hostId]
                  ?.map((meta) => readPreparation(meta.preparation, hostId))
                  .find(Boolean) ?? null;
              setRemotePreparation((current) =>
                JSON.stringify(current) === JSON.stringify(preview)
                  ? current
                  : preview,
              );
            }
          })
          .subscribe((status) => {
            if (!alive) return;
            setChannelHealthy(status === "SUBSCRIBED");
            if (status === "SUBSCRIBED") {
              void channel?.track({
                user_id: uid,
                ...(draftRef.current?.hostId === uid
                  ? { preparation: draftRef.current }
                  : {}),
              });
              void load();
            }
          });
        presenceChannel.current = channel;
      });
    const heartbeat = () => {
      void rpc("heartbeat", { room: roomId })
        .then(() => {
          if (!alive) return;
          setRestHealthy(true);
          void load();
        })
        .catch(() => {
          if (alive) setRestHealthy(false);
        });
    };
    heartbeat();
    const timer = setInterval(heartbeat, 15000);
    const focus = () => {
      heartbeat();
      void load();
    };
    const offline = () => setRestHealthy(false);
    window.addEventListener("online", focus);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", focus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("online", focus);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", focus);
      if (presenceChannel.current === channel) presenceChannel.current = null;
      if (channel) void supabase().removeChannel(channel);
    };
  }, [roomId, uid, refresh]);

  const host = Boolean(
    snapshot &&
    snapshot.host_id === uid &&
    !screen &&
    wheelCountdown === null &&
    !wheelSpinning,
  );
  const game = snapshot?.game;
  const active = game?.status === "active";

  const connected = channelHealthy && restHealthy;
  const roomPlayers = snapshot?.members.filter((m) => !m.display_only) ?? [];
  const shownHostId =
    wheelCountdown !== null || wheelSpinning
      ? (snapshot?.roulette?.previous_host_id ?? snapshot?.host_id)
      : snapshot?.host_id;

  // The event ID is consumed once. Its timer survives presence and snapshot refreshes.
  useEffect(() => {
    if (!snapshot?.roulette) return;
    const r = snapshot.roulette;
    if (lastRouletteId.current !== r.id) {
      const firstObservation = lastRouletteId.current === null;
      lastRouletteId.current = r.id;
      if (rouletteTimer.current) clearTimeout(rouletteTimer.current);
      rouletteTimer.current = null;
      setWheelSpinning(false);
      const startedAt = Date.parse(r.spun_at);
      const elapsed = Date.now() - startedAt;
      setWheelCountdown(null);
      if (firstObservation && elapsed >= 5100) {
        setWheelMembers(null);
        setWheelBanner(`${r.winner_nickname} organiza a sala.`);
        return;
      }
      const eligible =
        r.members ??
        snapshot.members.filter((m) => !m.spectator && !m.display_only);
      const idx = Math.max(
        0,
        eligible.findIndex((m) => m.user_id === r.winner_id),
      );
      const count = Math.max(1, eligible.length);
      if (r.mode === "roulette") {
        setWheelMembers(eligible);
        setWheelBanner("");
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        let spinStarted = false;
        const tick = () => {
          const remaining = startedAt + 3000 - Date.now();
          if (remaining > 0) {
            setWheelCountdown(Math.min(3, Math.ceil(remaining / 1000)));
          } else if (Date.now() < startedAt + 5100) {
            setWheelCountdown(null);
            if (!spinStarted) {
              spinStarted = true;
              setWheelDuration(
                reduced ? 0 : Math.max(0, startedAt + 5100 - Date.now()),
              );
              setWheelSpinning(true);
              playEventSound("roulette", sound, volume);
              const target =
                (360 - ((((idx + 0.5) * 360) / count) % 360)) % 360;
              setWheelAngle(
                (prev) =>
                  prev +
                  1440 +
                  ((target - (((prev % 360) + 360) % 360) + 360) % 360),
              );
            }
          } else {
            rouletteTimer.current = null;
            setWheelCountdown(null);
            setWheelSpinning(false);
            // Keep the event roster stable until the next draw.
            const winnerLabel =
              r.winner_id === uid ? "Você" : r.winner_nickname;
            const resultMessage =
              winnerLabel + " foi sorteado(a) na roleta para organizar!";
            setWheelBanner(resultMessage);
            showNotice(resultMessage);
            setLiveAnnouncement(
              "Roleta concluída: " + winnerLabel + " vai organizar a partida.",
            );
            return;
          }
          rouletteTimer.current = setTimeout(tick, 50);
        };
        tick();
      } else {
        setWheelMembers(null);
        setWheelBanner(`${r.winner_nickname} assumiu a organização da sala.`);
        setLiveAnnouncement(
          `${r.winner_nickname} assumiu a organização da sala.`,
        );
      }
    }
  }, [snapshot?.roulette, snapshot?.members, sound, volume, uid, showNotice]);

  useEffect(
    () => () => {
      if (rouletteTimer.current) clearTimeout(rouletteTimer.current);
    },
    [],
  );

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
    if (identityStatus !== "ready") return;
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

  // Presence carries only an ephemeral public preview. RPCs remain authoritative.
  const publicDraft = useMemo<PreparationPreview | null>(
    () =>
      host && !active
        ? {
            hostId: uid,
            rounds,
            words: exact ? Number(exact) : null,
            categories: cats,
            categoryOptions: allCats,
            mode: mode as PreparationPreview["mode"],
            selectedCount: chosen.length,
            availableCount: filtered.length,
          }
        : null,
    [
      host,
      active,
      uid,
      rounds,
      exact,
      cats,
      allCats,
      mode,
      chosen.length,
      filtered.length,
    ],
  );
  useEffect(() => {
    draftRef.current = publicDraft;
    if (!publicDraft || !channelHealthy) return;
    const timer = window.setTimeout(() => {
      void presenceChannel.current?.track({
        user_id: uid,
        preparation: publicDraft,
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [publicDraft, channelHealthy, uid]);

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
      data-experience={
        !roomId
          ? "entry"
          : active
            ? screen
              ? "television"
              : host
                ? "host"
                : "player"
            : "lobby"
      }
      data-phase={game?.phase}
      data-ready={uid && identityStatus === "ready" ? "true" : "false"}
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
            {snapshot && !connected && (
              <span className="connection" role="status">
                Reconectando…
              </span>
            )}
            <button
              className="quiet sound-toggle"
              type="button"
              aria-label={sound ? "Desativar som" : "Ativar som"}
              aria-pressed={sound}
              title={sound ? "Desativar som" : "Ativar som"}
              onClick={() => {
                setSound(!sound);
                sessionStorage.setItem("sound", String(!sound));
              }}
            >
              <Icon name={sound ? "speaker" : "speaker-off"} />
            </button>
            {sound && (
              <label className="volume">
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
            <span className="tv-chip">PALCO · 16:9</span>
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
          <EntryScreen>
            <EntryForm
              mode={entryMode}
              onModeChange={setEntryMode}
              nickname={nickname}
              onNicknameChange={setNickname}
              code={code}
              onCodeChange={setCode}
              nicknameRef={nicknameInput}
              ready={configured() && identityStatus === "ready"}
              busy={busy}
              screen={screen}
              onEnter={(create) => void enter(create, screen)}
            />
            {configured() && identityStatus === "loading" && (
              <p role="status" className="setup-note">
                Conectando sua identidade para entrar na sala…
              </p>
            )}
            {configured() && identityStatus === "error" && (
              <button
                className="secondary"
                type="button"
                onClick={() => void establishIdentity()}
              >
                Tentar conectar novamente
              </button>
            )}
            {!configured() && (
              <p className="setup-note">
                O jogo está aguardando a conexão com o Supabase. As instruções
                estão no README do projeto.
              </p>
            )}
          </EntryScreen>
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
                  : "Junte a galera."}
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
                      showNotice("Link de convite copiado!");
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
                      showNotice(`Código ${snapshot.code} copiado!`);
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
                  <div className="members-heading">
                    <h2>Na sala</h2>
                    <span
                      aria-label={`${roomPlayers.length} de 14 vagas ocupadas`}
                    >
                      <strong>{roomPlayers.length}</strong> / 14
                    </span>
                  </div>
                  <p className="members-room-code">
                    Código <strong>{snapshot.code}</strong>
                  </p>
                  <ul
                    className="member-list"
                    aria-label="Participantes da sala"
                    tabIndex={0}
                  >
                    {roomPlayers.map((m, index) => (
                      <li
                        key={m.user_id}
                        className="member-slot"
                        data-self={m.user_id === uid}
                      >
                        <span className="member-avatar">
                          <span
                            className="avatar"
                            style={{
                              background: playerColor(index),
                              color: "var(--palette-ink)",
                            }}
                          >
                            {m.nickname.slice(0, 1).toUpperCase()}
                          </span>
                          {m.user_id === uid && (
                            <span
                              className="self-marker"
                              role="img"
                              aria-label="Seu usuário"
                              title="Seu usuário"
                            >
                              <Icon name="user" />
                            </span>
                          )}
                        </span>
                        <div className="member-identity">
                          <strong title={m.nickname}>{m.nickname}</strong>
                          {(m.display_only || m.spectator) && (
                            <small>
                              {m.display_only ? "Telão" : "Espectador"}
                            </small>
                          )}
                        </div>
                        <span className="member-markers">
                          {m.user_id === shownHostId && (
                            <span
                              className="host-marker"
                              role="img"
                              aria-label="Organizador"
                              title="Organizador"
                            >
                              <Icon name="crown" />
                            </span>
                          )}
                          <span
                            className={`member-presence ${online.includes(m.user_id) ? "online" : "offline"}`}
                            role="img"
                            aria-label={
                              online.includes(m.user_id) ? "Online" : "Ausente"
                            }
                            title={
                              online.includes(m.user_id) ? "Online" : "Ausente"
                            }
                          />
                        </span>
                      </li>
                    ))}
                    {Array.from(
                      { length: Math.max(0, 14 - roomPlayers.length) },
                      (_, i) => (
                        <li
                          className="member-slot member-empty"
                          key={`empty-${i}`}
                          aria-hidden="true"
                        >
                          <span className="avatar">
                            <Icon name="user" />
                          </span>
                          <span>Vaga livre</span>
                        </li>
                      ),
                    )}
                  </ul>
                  {roomPlayers.length <= 14 && (
                    <p className="members-scroll-hint">
                      Role a lista para ver todos ↓
                    </p>
                  )}

                  <HostRoulette
                    viewerId={uid}
                    members={eligibleMembers}
                    drawMembers={wheelMembers ?? eligibleMembers}
                    memberColors={Object.fromEntries(
                      roomPlayers.map((m, i) => [m.user_id, playerColor(i)]),
                    )}
                    hostId={snapshot.host_id}
                    isHost={host}
                    busy={busy || wheelSpinning || wheelCountdown !== null}
                    wheelAngle={wheelAngle}
                    wheelSpinning={wheelSpinning}
                    wheelCountdown={wheelCountdown}
                    wheelDuration={wheelDuration}
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
                </section>

                {host && (
                  <section className="panel preparation" data-editable="true">
                    <h2>{game ? "Mais uma partida?" : "Prepare a partida"}</h2>
                    <p>Escolha as perguntas antes de abrir o tabuleiro.</p>
                    {catalog.length === 0 && (
                      <div role="status" className="empty-catalog-banner">
                        <strong>
                          Catálogo oficial sem perguntas liberadas.
                        </strong>
                        <p>
                          Nenhuma pergunta aprovada está disponível no momento.
                          {permanent
                            ? " Você pode criar perguntas próprias abaixo. O catálogo oficial depende de liberação editorial."
                            : " O catálogo oficial ainda depende de liberação editorial. Você pode aguardar e jogar como convidado quando houver perguntas, ou usar uma conta permanente para criar perguntas próprias."}
                        </p>
                      </div>
                    )}
                    <div className="preparation-workspace">
                      {" "}
                      <fieldset className="preparation-categories">
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
                                <span
                                  className="cat-icon-3d"
                                  aria-hidden="true"
                                >
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
                                    {stat.total} itens · {stat.w22} de 22
                                    palavras
                                  </small>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                      <div className="preparation-settings">
                        <h3>Ajustes da partida</h3>{" "}
                        <div className="fields">
                          <label>
                            Rodadas
                            <input
                              type="number"
                              min="1"
                              max="30"
                              value={rounds}
                              onChange={(e) =>
                                setRounds(Number(e.target.value))
                              }
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
                      </div>
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
                                        const data = await rpc<QuestionPreview>(
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
                              onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                    <div className="preparation-footer">
                      {filtered.length < rounds && (
                        <p className="insufficient" role="status">
                          Amplie os filtros ou reduza as rodadas.
                        </p>
                      )}
                      <div className="prep-stats-bar">
                        <span>
                          <strong>{filtered.length}</strong> elegíveis nos
                          filtros
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
                      <div className="actions">
                        <button
                          disabled={
                            busy ||
                            wheelCountdown !== null ||
                            wheelSpinning ||
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
                    </div>
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
                {!host && (
                  <PublicPreparation
                    draft={
                      remotePreparation?.hostId === shownHostId
                        ? remotePreparation
                        : null
                    }
                    hostName={
                      snapshot.members.find((m) => m.user_id === shownHostId)
                        ?.nickname ?? "O organizador"
                    }
                  />
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
