import { useEffect, useMemo, useState } from "react";
import type { Member } from "@/lib/game";
import { Icon } from "./game-icon";

const wheelPalette = [
  "var(--palette-mint)",
  "var(--palette-lilac)",
  "var(--palette-gold)",
  "var(--palette-paper)",
];

export function HostRoulette({
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
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    // Reduced motion skips spinning, but the shared result must still be visible.
    if (wheelBanner.includes("foi sorteado")) setExpanded(true);
  }, [wheelBanner]);
  const n = Math.max(1, members.length);
  const gradient = useMemo(() => {
    if (!members.length) return "var(--palette-gold)";
    const step = 360 / members.length;
    return `conic-gradient(from 0deg, ${members
      .map(
        (_, i) =>
          `${wheelPalette[i % wheelPalette.length]} ${(i * step).toFixed(1)}deg ${((i + 1) * step).toFixed(1)}deg`,
      )
      .join(", ")})`;
  }, [members]);

  return (
    <details
      className="organizer-options"
      open={expanded || wheelSpinning}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        {isHost ? "Trocar organizador" : "Ver sorteio do organizador"}
        <span>Opcional</span>
      </summary>
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
                    transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(var(--wheel-label-radius, -68px))`,
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
    </details>
  );
}
