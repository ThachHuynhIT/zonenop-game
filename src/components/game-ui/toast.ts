import { toast } from "sonner";

const base = "!rounded-2xl !border !font-bold";

/** Toasts in the game style (GamesShell already mounts sonner's <Toaster>). */
export const gameToast = {
  success: (msg: string) => toast.success(msg, { className: `${base} !border-emerald-400/40` }),
  error: (msg: string) => toast.error(msg, { className: `${base} !border-rose-400/40` }),
  info: (msg: string) => toast(msg, { className: `${base} !border-white/20` }),
};
