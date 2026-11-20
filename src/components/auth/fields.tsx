"use client";

import { useId } from "react";
import styles from "./fields.module.scss";

/** Labelled text input in the games look (dark field, accent focus). */
export function AuthField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  autoFocus,
  maxLength,
  hint,
  error,
  errorClassName,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "password";
  autoComplete?: string;
  autoFocus?: boolean;
  maxLength?: number;
  hint?: string;
  error?: string;
  errorClassName?: string;
}) {
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  return (
    <div>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        maxLength={maxLength}
        aria-describedby={[hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        autoCapitalize="none"
        spellCheck={false}
        className={styles.input}
      />
      {hint && <p id={hintId} className={styles.hint}>{hint}</p>}
      {error && <p id={errorId} className={errorClassName ?? styles.error}>{error}</p>}
    </div>
  );
}
