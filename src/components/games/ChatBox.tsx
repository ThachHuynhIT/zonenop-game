"use client";

import { useEffect, useRef, useState } from "react";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { AnimatePresence, m as motion } from "motion/react";
import { CHAT_MAX_LENGTH, type ChatMessage, EMOJIS } from "@/lib/tienlen";
import { cn } from "@/lib/utils";

/**
 * Floating room chat (bottom-right), shared by every game: free text for players and
 * spectators, unread badge, and a short preview of new messages while it is closed.
 * With `onEmoji` an emoji button sits right above it (the quick reactions that float over seats).
 */
export function ChatBox({
  messages = [],
  meId,
  myName,
  onSend,
  onEmoji,
  row,
}: {
  messages?: ChatMessage[];
  meId: string;
  /** Spectators have no seat id, so their own lines are matched by name. */
  myName?: string;
  onSend: (text: string) => Promise<boolean>;
  /** Send a quick emoji reaction; shows the 😀 button above the chat button. */
  onEmoji?: (emoji: string) => void;
  /** Put the emoji button left of the chat button instead of above it (keeps the pair one button tall). */
  row?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [seenId, setSeenId] = useState<string | null>(() => messages.at(-1)?.id ?? null);
  const [preview, setPreview] = useState<ChatMessage | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mine = (m: ChatMessage) => (meId ? m.playerId === meId : !m.playerId && m.name === myName);
  const lastId = messages.at(-1)?.id ?? null;
  const seenIndex = seenId ? messages.findIndex((m) => m.id === seenId) : -1;
  const unread = open ? 0 : messages.slice(seenIndex + 1).filter((m) => !mine(m)).length;

  // Mark everything read while open; otherwise pop a preview of the newest line from someone else.
  const lastSeenLast = useRef(lastId);
  useEffect(() => {
    if (lastId === lastSeenLast.current) return;
    lastSeenLast.current = lastId;
    const latest = messages.at(-1);
    if (open) setSeenId(lastId);
    else if (latest && !mine(latest)) setPreview(latest);
  }, [lastId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!preview) return;
    const t = setTimeout(() => setPreview(null), 3500);
    return () => clearTimeout(t);
  }, [preview]);

  useEffect(() => {
    if (!open) return;
    setSeenId(lastId);
    setPreview(null);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    inputRef.current?.focus();
  }, [open, lastId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    if (await onSend(t)) setText("");
    setSending(false);
    inputRef.current?.focus();
  };

  const time = (at: number) => new Date(at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-40 flex flex-col items-end gap-2 sm:bottom-4 sm:right-4">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96, pointerEvents: "none" }}
            className="flex h-[min(26rem,65dvh)] w-[min(20rem,calc(100vw-1.5rem))] short:h-[calc(100dvh-4.5rem)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0d1712]/95 text-sm text-white shadow-2xl backdrop-blur"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <b>💬 Trò chuyện</b>
              <button onClick={() => setOpen(false)} className="-my-1 -mr-1.5 grid size-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white max-sm:size-9" aria-label="Đóng chat">
                ✕
              </button>
            </div>
            <div ref={listRef} className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-2">
              {messages.length === 0 && <p className="m-auto text-center text-xs text-white/40">Chưa có tin nhắn nào — chào mọi người đi!</p>}
              {messages.map((m) => (
                <div key={m.id} className={cn("flex max-w-[85%] flex-col", mine(m) ? "items-end self-end" : "items-start self-start")}>
                  {!mine(m) && (
                    <span className="px-1 text-[11px] text-white/50">
                      {m.name}
                      {!m.playerId && " 👀"}
                    </span>
                  )}
                  <span
                    className={cn(
                      "whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5",
                      mine(m) ? "rounded-br-sm bg-amber-400 text-black" : "rounded-bl-sm bg-white/10",
                    )}
                    title={time(m.at)}
                  >
                    {m.text}
                  </span>
                </div>
              ))}
            </div>
            <form onSubmit={send} className="flex gap-2 border-t border-white/10 p-2">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, CHAT_MAX_LENGTH))}
                placeholder="Nhắn gì đó…"
                maxLength={CHAT_MAX_LENGTH}
                className="min-w-0 flex-1 rounded-lg bg-white/10 px-3 py-1.5 outline-none placeholder:text-white/40 focus:ring-1 focus:ring-amber-300 max-sm:min-h-10 max-sm:text-base"
                aria-label="Tin nhắn"
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                className="rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-black hover:bg-amber-300 disabled:opacity-40 max-sm:min-h-10"
              >
                Gửi
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {preview && !open && (
          <motion.button
            key={preview.id}
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            className="max-w-[min(16rem,calc(100vw-1.5rem))] truncate rounded-2xl rounded-br-sm bg-white px-3 py-1.5 text-left text-sm text-black shadow-lg"
          >
            <b>{preview.name}:</b> {preview.text}
          </motion.button>
        )}
      </AnimatePresence>

      <div className={cn("flex items-end gap-2", row ? "flex-row" : "flex-col")}>
        {onEmoji && (
          <div className="relative">
            <AnimatePresence>
              {emojiOpen && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10, pointerEvents: "none" }}
                  className={cn(
                    "absolute grid w-max grid-cols-5 gap-1 rounded-2xl border border-white/15 bg-[#0d1712]/95 p-1.5 shadow-2xl backdrop-blur sm:grid-cols-7",
                    row ? "bottom-full right-0 mb-2" : "bottom-0 right-full mr-2",
                  )}
                >
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        onEmoji(e);
                        setEmojiOpen(false);
                      }}
                      className="rounded-lg p-1.5 text-2xl leading-none transition-transform hover:scale-125 hover:bg-white/10"
                    >
                      {e}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={() => (setEmojiOpen((o) => !o), setOpen(false))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/70 text-xl shadow-lg backdrop-blur transition-transform hover:scale-105 sm:h-11 sm:w-11"
              aria-label="Thả emoji"
              aria-expanded={emojiOpen}
            >
              😀
            </button>
          </div>
        )}

        <button
          onClick={() => (setOpen((o) => !o), setEmojiOpen(false))}
          className="relative flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-xl text-black shadow-lg transition-transform hover:scale-105 sm:h-12 sm:w-12 sm:text-2xl"
          aria-label={open ? "Đóng chat" : "Mở chat"}
          aria-expanded={open}
        >
          💬
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
