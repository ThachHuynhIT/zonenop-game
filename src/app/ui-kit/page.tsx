import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UiKit } from "./UiKit";

export const metadata: Metadata = { title: "Game UI kit", robots: { index: false, follow: false } };

/** Dev-only gallery of the game-ui components (404 in production builds). */
export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiKit />;
}
