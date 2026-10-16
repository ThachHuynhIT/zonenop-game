import type { Variants } from "motion/react";

/** Things popping in (badges, chips, toasts). */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  shown: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 420, damping: 24 } },
};

/** The victory banner dropping in. */
export const winBanner: Variants = {
  hidden: { opacity: 0, y: -24, scale: 0.9 },
  shown: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 18 } },
};
