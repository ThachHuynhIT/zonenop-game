"use client";

import { useEffect, useId, useRef, useState } from "react";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { AnimatePresence, m as motion } from "motion/react";
import { CHAT_MAX_LENGTH, type ChatMessage, EMOJIS } from "@/lib/tienlen";
import { cn } from "@/lib/utils";
import styles from "./ChatBox.module.scss";

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
  const [sendError, setSendError] = useState<string | null>(null);
  const [seenId, setSeenId] = useState<string | null>(() => messages.at(-1)?.id ?? null);
  const [preview, setPreview] = useState<ChatMessage | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nearBottom = useRef(true);
  const sendingRef = useRef(false);
  const panelId = useId();

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
    setPreview(null);
    nearBottom.current = true;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSeenId(lastId);
    if (nearBottom.current) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, lastId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendError(null);
    inputRef.current?.focus();
    try {
      if (await onSend(t)) {
        setText((draft) => draft.trim() === t ? "" : draft);
        nearBottom.current = true;
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      } else setSendError("Chưa gửi được tin nhắn. Hãy thử gửi lại.");
    } catch {
      setSendError("Chưa gửi được tin nhắn. Hãy thử gửi lại.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const time = (at: number) => new Date(at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={styles.root}>
      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96, pointerEvents: "none" }}
            className={styles.panel}
          >
            <div className={styles.header}>
              <b>💬 Trò chuyện</b>
              <button onClick={() => setOpen(false)} className={styles.close} aria-label="Đóng chat">
                ✕
              </button>
            </div>
            <div ref={listRef} className={styles.log} role="log" aria-label="Tin nhắn trong phòng" aria-live="polite" aria-relevant="additions" onScroll={() => {
              const list = listRef.current;
              if (list) nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight <= 48;
            }}>
              {messages.length === 0 && <p className={styles.empty}>Chưa có tin nhắn nào — chào mọi người đi!</p>}
              {messages.map((m) => (
                <div key={m.id} className={cn(styles.message, mine(m) && styles.mine)}>
                  {!mine(m) && (
                    <span className={styles.sender}>
                      {m.name}
                      {!m.playerId && " 👀"}
                    </span>
                  )}
                  <span
                    className={styles.bubble}
                    title={time(m.at)}
                  >
                    {m.text}
                  </span>
                </div>
              ))}
            </div>
            {sendError && <p role="alert" className={styles.error}>{sendError}</p>}
            <form onSubmit={send} className={styles.form} aria-busy={sending}>
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, CHAT_MAX_LENGTH))}
                placeholder="Nhắn gì đó…"
                maxLength={CHAT_MAX_LENGTH}
                className={styles.input}
                aria-label="Tin nhắn"
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                className={styles.send}
              >
                {sending ? "Đang gửi…" : "Gửi"}
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
            className={styles.preview}
          >
            <b>{preview.name}:</b> {preview.text}
          </motion.button>
        )}
      </AnimatePresence>

      <div className={cn(styles.controls, row && styles.row)}>
        {onEmoji && (
          <div className={styles.emojiRoot}>
            <AnimatePresence>
              {emojiOpen && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10, pointerEvents: "none" }}
                  className={cn(styles.emojiPanel, row && styles.emojiAbove)}
                >
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        onEmoji(e);
                        setEmojiOpen(false);
                      }}
                      className={styles.emoji}
                      aria-label={`Thả ${e}`}
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
              className={styles.emojiToggle}
              aria-label="Thả emoji"
              aria-expanded={emojiOpen}
            >
              😀
            </button>
          </div>
        )}

        <button
          onClick={() => (setOpen((o) => !o), setEmojiOpen(false))}
          className={styles.toggle}
          aria-label={open ? "Đóng chat" : unread > 0 ? `Mở chat, ${unread} tin nhắn chưa đọc` : "Mở chat"}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
        >
          💬
          {unread > 0 && (
            <span className={styles.badge} aria-hidden="true">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
