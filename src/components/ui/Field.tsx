import { useId, type InputHTMLAttributes } from "react";
import s from "./Field.module.css";

export function Field({
  label,
  hint,
  error,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={s.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error ? (
        <span id={`${inputId}-err`} className={s.error}>
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className={s.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
