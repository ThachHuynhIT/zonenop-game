/** Where to go after signing in: only same-site paths ("/x", never "//host" or an absolute URL); anything else is the hub. */
export function safeNext(next: string | null | undefined): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  return next;
}
