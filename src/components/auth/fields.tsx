"use client";

import { useId } from "react";

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
      <label htmlFor={id} className="mb-1.5 block text-sm text-white/70">
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
        className="h-11 w-full rounded-xl border border-white/15 bg-black/40 px-4 text-base text-white outline-none transition-colors placeholder:text-white/30 focus:border-game-accent"
      />
      {hint && <p id={hintId} className="mt-1 text-xs text-white/50">{hint}</p>}
      {error && <p id={errorId} className={errorClassName}>{error}</p>}
    </div>
  );
}
