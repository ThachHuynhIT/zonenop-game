/** Commit this server runs: set by the self-hosted deploy (BUILD_COMMIT) or by Vercel; null when unknown (local dev). */
export const deployedCommit = (env: Record<string, string | undefined> = process.env): string | null =>
  env.BUILD_COMMIT || env.VERCEL_GIT_COMMIT_SHA || null;
