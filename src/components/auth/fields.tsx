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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "password";
  autoComplete?: string;
  autoFocus?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  const id = useId();
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
        autoCapitalize="none"
        spellCheck={false}
        className="h-11 w-full rounded-xl border border-white/15 bg-black/40 px-4 text-base text-white outline-none transition-colors placeholder:text-white/30 focus:border-game-accent"
      />
      {hint && <p className="mt-1 text-xs text-white/50">{hint}</p>}
    </div>
  );
}
