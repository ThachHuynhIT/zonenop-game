"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Toaster } from "sonner";
import { GameButton, GamePanel, GameTabs } from "@/components/game-ui";
import { authRequest, useSession, type AuthResult } from "@/components/auth/session";
import { cn } from "@/lib/utils";
import styles from "./AdminDashboard.module.scss";
import { Forbidden } from "./Forbidden";
import { ByGameTable, TopPagesTable, TopPlayersTable } from "./RankTables";
import { StatCards } from "./StatCards";
import { UsersSection } from "./UsersTable";
import type { AdminStats, DailyRow, StatsDays } from "./types";

const CHART_H = "h-60 sm:h-72";
const chartFallback = () => <div className={cn(CHART_H, "animate-pulse rounded-xl bg-white/[0.04]")} />;
// Recharts stays out of every other page: this chunk is fetched in the browser only, when the dashboard renders.
const TrafficChart = dynamic(() => import("./Charts").then((m) => m.TrafficChart), { ssr: false, loading: chartFallback });
const PlayChart = dynamic(() => import("./Charts").then((m) => m.PlayChart), { ssr: false, loading: chartFallback });

const PERIODS: StatsDays[] = [7, 30, 90];
const SIGN_IN = "/dang-nhap?next=/admin";

const noop = () => () => {};
/** False during SSR and hydration, true afterwards (the session lives in localStorage). */
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

/** /admin: sign-in and admin checks, then the "Thống kê" and "Người dùng" tabs. */
export function AdminDashboard() {
  const hydrated = useHydrated();
  const session = useSession();
  const router = useRouter();
  const [days, setDays] = useState<StatsDays>(30);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; token: string; res: AuthResult<AdminStats> } | null>(null);
  const token = session?.session ?? null;
  const key = `${days}|${attempt}|${token}`;
  const currentResult = result?.token === token ? result : null;
  const status = currentResult?.res.ok === false ? currentResult.res.status : 200;

  useEffect(() => {
    if (hydrated && (!token || status === 401)) router.replace(SIGN_IN);
  }, [hydrated, token, status, router]);

  useEffect(() => {
    if (!token) return;
    let live = true;
    void authRequest<AdminStats>("GET", `/api/admin/stats?days=${days}`).then((res) => {
      if (live) setResult({ key, token, res });
    });
    return () => {
      live = false;
    };
  }, [key, token, days]);

  if (!hydrated || !token || status === 401) return <Shell>{null}</Shell>;

  // The server decides (the stored role may be stale): a 403 from the stats route means "not an admin".
  if (status === 403) {
    return (
      <Shell>
        <Forbidden />
      </Shell>
    );
  }

  const loading = currentResult?.key !== key;
  const stats = currentResult?.res.ok ? currentResult.res.data : null;
  const error = currentResult && !currentResult.res.ok && !loading ? currentResult.res.error : null;

  return (
    <Shell user={session?.user.username}>
      <section className={styles.overview} aria-label="Tổng quan">
        <div className={styles.toolbar}>
          <div role="group" aria-label="Khoảng thời gian" className={styles.periods}>
            {PERIODS.map((period) => <button key={period} type="button" aria-pressed={days === period} onClick={() => setDays(period)}>{period} ngày</button>)}
          </div>
          {loading && <span role="status" className={styles.status}>Đang tải số liệu…</span>}
        </div>
        {error ? <GamePanel className={styles.error}>
          <h2>Không tải được số liệu</h2><p>{error}</p>
          <GameButton onClick={() => setAttempt((value) => value + 1)}><RotateCw aria-hidden />Thử lại</GameButton>
        </GamePanel> : stats ? <div aria-busy={loading || undefined}><StatCards totals={stats.totals} daily={stats.daily} days={stats.days} /></div> : <StatsSkeleton />}
      </section>
      <GameTabs
        className="bg-transparent"
        tabs={[
          {
            id: "stats",
            label: "Thống kê",
            content: (
              <StatsView
                stats={stats}
                loading={loading}
              />
            ),
          },
          { id: "users", label: "Người dùng", content: <UsersSection selfId={session?.user.id ?? null} /> },
        ]}
      />
    </Shell>
  );
}

function Shell({ user, children }: { user?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-5 sm:px-6 sm:pt-8">
      <Toaster theme="dark" position="top-center" richColors visibleToasts={3} toastOptions={{ duration: 2800 }} />
      <header className="mb-5 flex flex-wrap items-end gap-x-4 gap-y-2 sm:mb-7">
        <div className="min-w-0">
          <Link href="/" className="-ml-3 inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-white/65 hover:bg-white/10 hover:text-white">
            <ArrowLeft aria-hidden className="size-4" />
            Sảnh game
          </Link>
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">Quản trị</h1>
        </div>
        {user && (
          <p className="ml-auto pb-1 text-sm text-white/60">
            Đang đăng nhập: <span className="font-bold text-white">{user}</span>
          </p>
        )}
      </header>
      {children}
    </div>
  );
}

/** Daily charts and rankings; the shared overview is rendered above the tabs. */
export function StatsView({
  stats,
  loading,
}: {
  stats: AdminStats | null;
  loading: boolean;
}) {
  return (
    <div className="space-y-4 py-2 sm:space-y-5">
      {!stats ? null : (
        <div className={cn("space-y-4 transition-opacity sm:space-y-5", loading && "opacity-60")} aria-busy={loading || undefined}>
          <div className="grid gap-4 lg:grid-cols-2 sm:gap-5">
            <ChartPanel title="Lượt xem và số máy" legend={[["Lượt xem", 1], ["Số máy", 2]]} daily={stats.daily}>
              <TrafficChart daily={stats.daily} />
            </ChartPanel>
            <ChartPanel title="Ván chơi và người chơi" legend={[["Số ván", 1], ["Người chơi", 2]]} daily={stats.daily}>
              <PlayChart daily={stats.daily} />
            </ChartPanel>
          </div>
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
            <ByGameTable rows={stats.byGame} />
            <TopPagesTable rows={stats.topPages} />
            <TopPlayersTable rows={stats.topPlayers} />
          </div>
        </div>
      )}
    </div>
  );
}

function ChartPanel({ title, legend, daily, children }: { title: string; legend: [string, 1 | 2][]; daily: DailyRow[]; children: React.ReactNode }) {
  return (
    <GamePanel className="min-w-0">
      {/* Own header (not GamePanel's title/actions) so the legend drops under the title on phones instead of squeezing it. */}
      <header className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="font-heading text-lg font-extrabold tracking-tight">{title}</h2>
        <ul className="flex gap-3 text-xs text-white/70 sm:ml-auto">
          {legend.map(([label, n]) => (
            <li key={label} className="flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden className={cn("size-2.5 rounded-full", n === 1 ? "bg-[var(--game-chart-1)]" : "bg-[var(--game-chart-2)]")} />
              {label}
            </li>
          ))}
        </ul>
      </header>
      <div className={CHART_H} role="img" aria-label={`${title}, ${daily.length} ngày`}>
        {children}
      </div>
    </GamePanel>
  );
}

function StatsSkeleton() {
  return (
    <div aria-busy className={styles.skeleton}>
      <span className={styles.srOnly} role="status">
        Đang tải số liệu
      </span>
      <div className={styles.skeletonCards}>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className={styles.skeletonCard} />
        ))}
      </div>

    </div>
  );
}
