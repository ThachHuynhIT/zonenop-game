/** Shapes of the be_game admin routes (API contract, docs/superpowers/specs/2026-10-16-accounts-admin-design.md). */

export type StatsDays = 7 | 30 | 90;

export interface DailyRow {
  day: string;
  views: number;
  devices: number;
  games: number;
  players: number;
  newUsers: number;
}

export interface AdminStats {
  days: number;
  totals: { users: number; newUsers: number; views: number; devices: number; games: number; players: number; playDevices: number };
  daily: DailyRow[];
  byGame: { game: string; games: number; players: number }[];
  topPages: { path: string; views: number }[];
  topPlayers: { name: string; games: number; points: number }[];
}

export interface AdminUser {
  id: string;
  username: string;
  role: "user" | "admin";
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  games: number;
}

export interface AdminUsersPage {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}
