"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "./page.module.scss";

// ssr: false — the canvas game touches window/keyboard on mount, so it only ever renders client-side.
const ContraGame = dynamic(() => import("@/components/game/ContraGame"), {
  ssr: false,
  loading: () => (
    <div className={styles.loading} role="status">
      <p>ĐANG TẢI CONTRA…</p><p>Chuẩn bị màn chơi</p>
    </div>
  ),
});

export default function ContraPage() {
  return (
    <div className={styles.page} data-game="hub">
      <div className={styles.navigation}>
        <Link
          href="/"
          className={styles.back}
        >
          <ArrowLeft size={14} aria-hidden /> Sảnh trò chơi
        </Link>
      </div>
      <ContraGame />
    </div>
  );
}
