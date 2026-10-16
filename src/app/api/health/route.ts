import { deployedCommit } from "@/lib/deployedCommit";

// Read at request time: the commit is a runtime env of the container / Vercel function, not baked into the build.
export const dynamic = "force-dynamic";

/** Liveness + the commit being served: the deploy workflow waits for it to equal the commit it shipped. */
export function GET() {
  return Response.json({ ok: true, commit: deployedCommit() }, { headers: { "cache-control": "no-store" } });
}
