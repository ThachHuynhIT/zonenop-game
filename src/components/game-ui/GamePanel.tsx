import { cn } from "@/lib/utils";
import styles from "./PixelPrimitives.module.scss";

/** An ink-outlined pixel panel for lobby lists, scores and settings. */
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
      data-tone={tone}
      className={cn(styles.panel, className)}
    >
      {(title || actions) && (
        <header className={styles.panelHeader}>
          {icon && <span aria-hidden className={styles.panelIcon}>{icon}</span>}
          {title && <h2 className={styles.panelTitle}>{title}</h2>}
          {actions && <div className={styles.panelActions}>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
