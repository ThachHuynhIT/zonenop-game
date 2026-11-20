import type { GameId } from "./theme";

export type PixelIconName = GameId | "contra" | "controller";

// Drawn on an integer 32px grid. Vector assets stay sharp at every device scale;
// text and detailed card illustrations are deliberately never pixel-filtered.
const ART: Record<PixelIconName, React.ReactNode> = {
  controller: <><path fill="#a9bdd4" d="M6 9h20v3h3v14h-6v-3H9v3H3V12h3z" /><path fill="#526c92" d="M6 12h20v8H6z" /><path fill="#070d19" d="M9 12h3v3h3v3h-3v3H9v-3H6v-3h3z" /><path fill="#ff927e" d="M22 13h3v3h-3z" /><path fill="#ffd66b" d="M18 17h3v3h-3z" /></>,
  tienlen: <><path fill="#83e0bb" d="M3 5h18v22H3z" /><path fill="#f4ecd8" d="M10 3h19v25H10z" /><path fill="#ff927e" d="M15 8h3v3h3V8h3v6h-3v3h-3v-3h-3zM14 22h4v3h-4z" /><path fill="#a9bdd4" d="M24 3h5v25h-5v-3h2V6h-2z" /></>,
  meono: <><path fill="#ffb467" d="M4 4h7v5h10V4h7v21h-4v4H8v-4H4z" /><path fill="#ff927e" d="M7 7h3v5H7zM23 7h3v5h-3z" /><path fill="#070d19" d="M8 15h4v4H8zM20 15h4v4h-4zM14 21h4v3h-4z" /><path fill="#ffd66b" d="M13 26h6v3h-6z" /></>,
  typhu: <><path fill="#ffd66b" d="M3 15h26v14H3z" /><path fill="#83e0bb" d="M6 12h3V9h3V6h8v3h3v3h3v3H6z" /><path fill="#f4ecd8" d="M9 18h3v7H9zM20 18h3v7h-3z" /><path fill="#070d19" d="M14 20h4v9h-4zM1 28h30v3H1z" /><path fill="#ff927e" d="M23 5h3v7h-3z" /></>,
  splendor: <><path fill="#b79aff" d="M9 4h14v3h4v4h4v5h-4v4h-4v4h-4v4h-6v-4H9v-4H5v-4H1v-5h4V7h4z" /><path fill="#eee0ff" d="M9 4h6v7H5V7h4zM15 11h5v10h-5z" /><path fill="#7853b7" d="M22 7h5v4h4v5h-4v4h-4v4h-4v4h-3V16h6z" /></>,
  bang: <><path fill="#b97948" d="M9 6h14v4h3v7h5v6H1v-6h5v-7h3z" /><path fill="#ffd66b" d="M6 14h20v4H6z" /><path fill="#f4ecd8" d="M11 24h10v6H11z" /><path fill="#ff927e" d="M14 4h4v6h-4z" /></>,
  oanquan: <><path fill="#d6a75c" d="M2 8h28v17H2z" /><path fill="#a16c40" d="M0 11h4v11H0zM28 11h4v11h-4z" /><path fill="#070d19" d="M6 11h5v5H6zM13 11h5v5h-5zM20 11h5v5h-5zM6 18h5v5H6zM13 18h5v5h-5zM20 18h5v5h-5z" /><path fill="#f4ecd8" d="M7 12h2v2H7zM14 19h2v2h-2zM21 12h2v2h-2zM7 19h2v2H7zM14 12h2v2h-2zM21 19h2v2h-2z" /></>,
  noichu: <><path fill="#83e0bb" d="M2 4h28v20H14l-8 6v-6H2z" /><path fill="#070d19" d="M6 9h3v9H6zM9 9h3v3H9zM12 9h3v9h-3zM19 9h7v3h-7zM19 15h7v3h-7zM19 12h3v3h-3z" /></>,
  cangua: <><path fill="#99c5ff" d="M12 3h9v3h5v10h-5v5h-3v5h10v4H5v-4h5V16H5v-5h4V6h3z" /><path fill="#f4ecd8" d="M12 3h4v8h-4zM8 26h17v2H8z" /><path fill="#070d19" d="M21 9h3v3h-3z" /><path fill="#526c92" d="M12 18h6v8h-6z" /></>,
  contra: <><path fill="#83e0bb" d="M12 3h8v3h3v7H9V6h3zM10 18h13v6H10zM6 24h8v6H6zM20 24h8v6h-8z" /><path fill="#ff927e" d="M9 8h14v3H9zM11 13h10v6H11z" /><path fill="#a9bdd4" d="M16 15h15v5H16zM25 13h3v3h-3z" /><path fill="#ffd66b" d="M29 15h3v3h-3z" /></>,
};

export function PixelIcon({ name, className }: { name: PixelIconName; className?: string }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 32 32" width="32" height="32" shapeRendering="crispEdges" className={className}>{ART[name]}</svg>;
}
