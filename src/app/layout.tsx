import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { domMax, LazyMotion, MotionConfig } from "motion/react";
import PageTracker from "../components/auth/PageTracker";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Self-hosted (SIL OFL, licences in ./fonts) instead of next/font/google: Vercel's Turbopack build
// kept failing on the Google font fetch. Variable fonts subset to Latin + Vietnamese.
const geistSans = localFont({
  src: "./fonts/Geist-latin-vietnamese.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-latin-vietnamese.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const bricolageGrotesque = localFont({
  src: "./fonts/BricolageGrotesque-latin-vietnamese.woff2",
  variable: "--font-display",
  weight: "400 800",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Games — chơi online cùng bạn bè",
    template: "%s | Games",
  },
  description:
    "Tiến Lên, Mèo Nổ, Cờ Tỷ Phú, Splendor, Bang!, Ô Ăn Quan, Cờ Cá Ngựa, Nối Chữ — tạo phòng, gửi link mời bạn bè.",
  openGraph: { siteName: "Games", type: "website" },
  twitter: { card: "summary" },
};

export const viewport: Viewport = {
  // Game tables run edge-to-edge on phones; the game shell handles safe-area insets.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolageGrotesque.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* domMax (not domAnimation): Cờ Tỷ Phú animates tokens with layoutId. */}
          <LazyMotion features={domMax} strict>
            <MotionConfig reducedMotion="user">{children}</MotionConfig>
            <PageTracker />
          </LazyMotion>
        </ThemeProvider>
      </body>
    </html>
  );
}
