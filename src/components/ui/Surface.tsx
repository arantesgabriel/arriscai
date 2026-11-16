import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import s from "./Surface.module.css";

export function Card({
  tone = "default",
  flat,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "default" | "subtle" | "private" | "stage";
  flat?: boolean;
}) {
  return (
    <div className={cx(s.card, tone !== "default" && s[tone], flat && s.flat, className)} {...rest} />
  );
}

export function Badge({
  tone = "default",
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "highlight" | "brand" | "success" | "danger";
}) {
  return <span className={cx(s.badge, tone !== "default" && s[`badge-${tone}`], className)} {...rest} />;
}

export function Status({
  tone = "info",
  icon,
  children,
  className,
}: {
  tone?: "info" | "success" | "danger" | "warning";
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx(s.status, s[`status-${tone}`], className)}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}

export function ScoreChip({
  name,
  points,
  active,
}: {
  name: string;
  points: number;
  active?: boolean;
}) {
  return (
    <span className={cx(s.chip, active && s["chip-active"])} aria-current={active || undefined}>
      {name} <strong>{points}</strong>
    </span>
  );
}
