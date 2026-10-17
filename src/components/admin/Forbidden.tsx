import Link from "next/link";
import { GamePanel } from "@/components/game-ui";

/** Shown when the server answers 403 to an admin route. */
export function Forbidden() {
  return (
    <GamePanel className="mx-auto mt-10 max-w-md text-center">
      <p aria-hidden className="text-4xl">🔒</p>
      <h2 className="mt-2 text-2xl font-black">Bạn không có quyền xem trang này</h2>
      <p className="mt-2 text-sm text-white/65">Trang quản trị chỉ dành cho tài khoản quản trị. Đăng nhập bằng tài khoản khác nếu bạn có.</p>
      <Link href="/" className="mt-4 inline-flex h-11 items-center rounded-full bg-white/12 px-5 font-bold ring-1 ring-inset ring-white/15 hover:bg-white/18">
        Về sảnh game
      </Link>
    </GamePanel>
  );
}
