import { useEffect, useRef, useState } from "react";
import type { Member } from "@/lib/game";
import { Icon } from "./game-icon";
import { playerColor } from "./player-colors";

export function HostRoulette({
  members,
  viewerId,
  drawMembers,
  memberColors,
  hostId,
  isHost,
  busy,
  wheelAngle,
  wheelSpinning,
  wheelCountdown,
  wheelDuration,
  wheelBanner,
  onChooseManual,
  onSpin,
}: {
  members: Member[];
  viewerId: string;
  drawMembers: Member[];
  memberColors: Record<string, string>;
  hostId: string;
  isHost: boolean;
  busy: boolean;
  wheelAngle: number;
  wheelSpinning: boolean;
  wheelCountdown: number | null;
  wheelDuration: number;
  wheelBanner: string;
  onChooseManual: (memberId: string) => void;
  onSpin: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [method, setMethod] = useState<"roulette" | "manual">("roulette");
  const [manualId, setManualId] = useState(hostId);
  const selectedId = members.some((m) => m.user_id === manualId)
    ? manualId
    : hostId;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const running = wheelCountdown !== null || wheelSpinning;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (expanded || running) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) dialog.close();
  }, [expanded, running]);
  const wasRunning = useRef(false);
  useEffect(() => {
    if (running) {
      setMethod("roulette");
      setExpanded(true);
    } else if (wasRunning.current) {
      setExpanded(false);
    }
    wasRunning.current = running;
  }, [running]);
  const n = Math.max(1, drawMembers.length);
  const point = (angle: number) => [
    Math.sin((angle * Math.PI) / 180) * 145,
    -Math.cos((angle * Math.PI) / 180) * 145,
  ];

  return (
    <div className="organizer-options">
      <button
        className="organizer-toggle quiet"
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setMethod("roulette");
          setManualId(hostId);
          setExpanded(true);
        }}
      >
        <Icon name="crown" />
        {isHost ? "Trocar Host" : "Ver sorteio do Host"}
        <Icon name="arrow" />
      </button>
      <dialog
        ref={dialogRef}
        className="organizer-dialog"
        aria-labelledby="organizer-title"
        onCancel={(event) => {
          if (running) event.preventDefault();
          else setExpanded(false);
        }}
        onClose={() => setExpanded(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget && !running)
            setExpanded(false);
        }}
      >
        <div className="organizer-dialog-content">
          <div className="organizer-dialog-heading">
            <h2 id="organizer-title">Quem será o Host?</h2>
            <button
              type="button"
              className="quiet"
              aria-label="Fechar troca de Host"
              disabled={running}
              onClick={() => setExpanded(false)}
            >
              ×
            </button>
          </div>
          {isHost && !running && (
            <div
              className="organizer-methods"
              role="group"
              aria-label="Forma de escolher Host"
            >
              <button
                type="button"
                aria-pressed={method === "roulette"}
                disabled={busy}
                onClick={() => setMethod("roulette")}
              >
                <Icon name="wheel" /> Sortear na roleta
              </button>
              <button
                type="button"
                aria-pressed={method === "manual"}
                disabled={busy}
                onClick={() => {
                  setManualId(hostId);
                  setMethod("manual");
                }}
              >
                <Icon name="user" /> Selecionar manualmente
              </button>
            </div>
          )}
          <div className="roulette-box">
            {(method === "roulette" || running) && (
              <>
                <div
                  className="wheel-stage"
                  data-counting={wheelCountdown !== null}
                >
                  <svg
                    className="wheel-pointer"
                    viewBox="0 0 36 44"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 3h30L18 39Z"
                      fill="var(--palette-gold)"
                      stroke="var(--palette-ink)"
                      strokeWidth="4"
                    />
                  </svg>
                  <div
                    className={`wheel-disc ${wheelSpinning ? "spinning" : ""}`}
                    style={{
                      transform: `rotate(${wheelAngle}deg)`,
                      transitionDuration: `${wheelDuration}ms`,
                    }}
                    aria-hidden="true"
                  >
                    <svg className="wheel-sectors" viewBox="-160 -160 320 320">
                      <circle r="154" fill="var(--palette-ink)" />
                      <circle r="148" fill="var(--palette-lilac)" />
                      {drawMembers.map((m, i) => {
                        const start = (i * 360) / n,
                          end = ((i + 1) * 360) / n;
                        const [sx, sy] = point(start),
                          [ex, ey] = point(end);
                        return (
                          <g key={m.user_id}>
                            {n === 1 ? (
                              <circle
                                r="145"
                                fill={memberColors[m.user_id] ?? playerColor(i)}
                              />
                            ) : (
                              <path
                                d={`M0 0L${sx} ${sy}A145 145 0 ${360 / n > 180 ? 1 : 0} 1 ${ex} ${ey}Z`}
                                fill={memberColors[m.user_id] ?? playerColor(i)}
                                stroke="var(--palette-ink)"
                                strokeWidth="1.5"
                              />
                            )}
                            <text
                              className="wheel-name"
                              transform={`rotate(${(start + end) / 2}) translate(0 -99) rotate(90)`}
                              textAnchor="middle"
                              dominantBaseline="central"
                            >
                              {m.user_id === viewerId
                                ? "Você"
                                : m.nickname.slice(0, 12)}
                            </text>
                          </g>
                        );
                      })}
                      <circle
                        r="24"
                        fill="var(--palette-ink)"
                        stroke="var(--palette-paper)"
                        strokeWidth="3"
                      />
                      <path
                        d="m0-12 4 8 9 1-6 6 1 9-8-4-8 4 1-9-6-6 9-1Z"
                        fill="var(--palette-gold)"
                      />
                    </svg>
                  </div>
                  {wheelCountdown !== null && (
                    <div
                      className="wheel-countdown"
                      role="status"
                      aria-live="assertive"
                    >
                      <span>O sorteio começa em</span>
                      <strong>{wheelCountdown}</strong>
                    </div>
                  )}
                </div>
                {wheelSpinning && (
                  <p className="wheel-progress" role="status">
                    Girando a roleta…
                  </p>
                )}
              </>
            )}
            {wheelBanner && method === "roulette" && !running && (
              <p className="wheel-announcement" role="status">
                {wheelBanner}
              </p>
            )}
            {isHost && !running && (
              <div className="actions">
                {method === "manual" && (
                  <>
                    <label>
                      Selecione o Host
                      <select
                        aria-label="Escolher Host"
                        value={selectedId}
                        disabled={busy}
                        onChange={(e) => setManualId(e.target.value)}
                      >
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.nickname}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={busy || selectedId === hostId}
                      onClick={() => {
                        onChooseManual(selectedId);
                        setExpanded(false);
                      }}
                    >
                      Confirmar novo Host
                    </button>
                  </>
                )}
                {method === "roulette" && (
                  <button
                    className="secondary"
                    type="button"
                    disabled={busy || members.length < 2}
                    onClick={onSpin}
                  >
                    <Icon name="wheel" /> Sortear Host
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
