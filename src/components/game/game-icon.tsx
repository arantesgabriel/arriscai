export function Icon({
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
          fill="var(--palette-gold)"
          stroke="var(--palette-ink)"
          d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"
        />
      ) : name === "trophy" ? (
        <>
          <path
            fill="var(--palette-gold)"
            stroke="var(--palette-ink)"
            d="M7 3h10v7a5 5 0 0 1-10 0V3Z"
          />
          <path
            stroke="var(--palette-ink)"
            d="M12 15v6m-4 0h8M7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4"
          />
        </>
      ) : name === "crown" ? (
        <path
          fill="var(--palette-gold)"
          stroke="var(--palette-ink)"
          d="m2 18 2-11 5 4 3-6 3 6 5-4 2 11H2Z"
        />
      ) : name === "wheel" ? (
        <>
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="var(--palette-gold)"
            stroke="var(--palette-ink)"
          />
          <circle
            cx="12"
            cy="12"
            r="2.5"
            fill="var(--palette-paper)"
            stroke="var(--palette-ink)"
          />
          <path
            stroke="var(--palette-ink)"
            d="M12 3v6.5M12 14.5V21M3 12h6.5M14.5 12H21"
          />
        </>
      ) : name === "fullscreen" ? (
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
      ) : name === "bulb" ? (
        <path
          fill="var(--palette-gold)"
          stroke="var(--palette-ink)"
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
            fill="var(--palette-gold)"
            stroke="var(--palette-ink)"
          />
          <path
            stroke="var(--palette-ink)"
            d="M3 8 6 3h13l2 5M8 3l2 5m4-5 2 5"
          />
        </>
      ) : name === "music" ? (
        <>
          <path stroke="var(--palette-ink)" d="M9 18V5l12-2v13" />
          <circle
            cx="6"
            cy="18"
            r="3"
            fill="var(--palette-gold)"
            stroke="var(--palette-ink)"
          />
          <circle
            cx="18"
            cy="16"
            r="3"
            fill="var(--palette-gold)"
            stroke="var(--palette-ink)"
          />
        </>
      ) : name === "ball" ? (
        <>
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="var(--palette-gold)"
            stroke="var(--palette-ink)"
          />
          <path
            stroke="var(--palette-ink)"
            d="M4.5 9.5c5 0 10 0 15 0M4.5 14.5h15M12 3v18"
          />
        </>
      ) : name === "globe" ? (
        <>
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="var(--palette-mint)"
            stroke="var(--palette-ink)"
          />
          <path
            stroke="var(--palette-ink)"
            d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"
          />
        </>
      ) : name === "column" ? (
        <>
          <path
            fill="var(--palette-gold)"
            stroke="var(--palette-ink)"
            d="M4 6h16v3H4zM4 18h16v3H4z"
          />
          <path stroke="var(--palette-ink)" d="M7 9v9m5-9v9m5-9v9" />
        </>
      ) : name === "atom" ? (
        <>
          <circle
            cx="12"
            cy="12"
            r="2.5"
            fill="var(--palette-gold)"
            stroke="var(--palette-ink)"
          />
          <ellipse
            cx="12"
            cy="12"
            rx="9"
            ry="4"
            transform="rotate(30 12 12)"
            stroke="var(--palette-ink)"
          />
          <ellipse
            cx="12"
            cy="12"
            rx="9"
            ry="4"
            transform="rotate(-30 12 12)"
            stroke="var(--palette-ink)"
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
            fill="var(--palette-gold)"
            stroke="var(--palette-ink)"
          />
          <path
            stroke="var(--palette-ink)"
            d="M6 12h4m-2-2v4m7-1h.01M18 11h.01"
          />
        </>
      ) : (
        <path d="m9 5 7 7-7 7" />
      )}
    </svg>
  );
}
