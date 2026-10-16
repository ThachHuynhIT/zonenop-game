import { cn } from "@/lib/utils";

/** A rounded, slightly raised card for lobby lists, scores and settings. */
export function GamePanel({
  title,
  icon,
  actions,
  tone = "default",
  className,
  children,
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: "default" | "accent";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "game-raised rounded-game-card border p-4 [--game-depth:3px] sm:p-5",
        tone === "accent"
          ? "border-game-accent/40 bg-game-accent-soft"
          : "border-white/10 bg-white/[0.06] backdrop-blur [--game-raise-color:oklch(0_0_0/0.4)]",
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-3 flex items-center gap-2">
          {icon && <span aria-hidden className="text-xl">{icon}</span>}
          {title && <h2 className="font-heading text-lg font-extrabold tracking-tight">{title}</h2>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
