"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { AnimatePresence, m as motion } from "motion/react";
import { type TPGameView } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";
import { ArtIcon, Building } from "../shared";

const MONEY_BITS = ["💸", "💵", "🪙", "💸", "💵", "🪙", "💸", "💵", "🪙", "💸", "💵", "🪙"];

/** Full-screen "PHÁ SẢN!" moment: a red flash, the name stamped in, money raining down. */
export function BankruptOverlay({ fx }: { fx: { id: string; name: string; me: boolean; at: number } | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {fx && (
        <motion.div
          key={fx.at}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
        >
          <motion.div
            className="absolute inset-0 bg-rose-900"
            initial={{ opacity: 0.75 }}
            animate={{ opacity: [0.75, 0.35, 0.5] }}
            transition={{ duration: 0.9 }}
          />
          {MONEY_BITS.map((m, i) => (
            <motion.span
              key={i}
              className="absolute top-0 text-3xl sm:text-5xl"
              style={{ left: `${(i * 83) % 100}%` }}
              initial={{ y: "-10vh", rotate: 0, opacity: 1 }}
              animate={{ y: "110vh", rotate: (i % 2 ? 1 : -1) * 360, opacity: [1, 1, 0.6] }}
              transition={{ duration: 2.2 + (i % 4) * 0.35, delay: (i % 6) * 0.12, ease: "easeIn" }}
            >
              {m}
            </motion.span>
          ))}
          <motion.div
            className="relative flex flex-col items-center gap-2 px-4 text-center"
            initial={{ scale: 3, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: -6, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14 }}
          >
            <span className="rounded-2xl border-4 border-white bg-rose-600 px-5 py-2 text-4xl font-black tracking-widest text-white shadow-2xl sm:text-6xl">PHÁ SẢN!</span>
            <span className="rounded-full bg-black/70 px-4 py-1 text-base font-bold text-white sm:text-xl">
              {fx.me ? "Bạn đã phá sản 😵" : `${fx.name} đã phá sản`}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function BuildOverlay({ fx }: { fx: { id: number; text: string; hotel: boolean } | null }) {
  return (
    <AnimatePresence>
      {fx && (
        <motion.div
          key={fx.id}
          className="pointer-events-none absolute inset-x-0 top-[12%] z-20 flex flex-col items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: [0, 1.3, 1], rotate: 0 }}
            transition={{ duration: 0.5 }}
            className="h-14 drop-shadow-lg sm:h-20"
          >
            <Building hotel={fx.hotel} className="h-full" />
          </motion.div>
          <p className="mt-1 rounded-full bg-emerald-800 px-3 py-1 text-xs font-semibold text-white shadow sm:text-sm">{fx.text}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CardOverlay({ card, nameOf, onClose }: { card: TPGameView["lastCard"]; nameOf: (id: string) => string; onClose: () => void }) {
  return (
    <AnimatePresence>
      {card && (
        <motion.div
          key={card.at}
          onClick={onClose}
          className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-black/25 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          // Let clicks through as soon as it starts fading, so it never blocks the roll button.
          exit={{ opacity: 0, pointerEvents: "none", transition: { duration: 0.2 } }}
        >
          <motion.div
            initial={{ rotateY: 180, scale: 0.6 }}
            animate={{ rotateY: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
            className={cn(
              "w-full max-w-xs rounded-2xl border-4 p-4 text-center shadow-2xl",
              card.deck === "chance" ? "border-orange-400 bg-orange-50" : "border-sky-400 bg-sky-50",
            )}
          >
            <p className="flex justify-center"><ArtIcon name={card.deck === "chance" ? "chance" : "chest"} className="size-14" /></p>
            <p className="text-sm font-black uppercase tracking-wide">{card.deck === "chance" ? "Cơ hội" : "Khí vận"}</p>
            <p className="mt-2 text-sm">{card.text}</p>
            <p className="mt-2 text-xs text-black/50">— {nameOf(card.player)}</p>
            <p className="mt-2 text-[11px] text-black/40">Chạm để đóng</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
