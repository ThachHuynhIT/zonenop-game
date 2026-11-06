// Run by .github/workflows/deploy.yml before anything reaches a shell or the SSH config: each value that ends up
// in a command, an ssh_config line or a URL must match a strict pattern, so a stray newline, quote or `$(...)` in a
// secret or variable is refused instead of being interpreted. Messages name the variable, never its value.
//   node scripts/check-deploy-env.mjs        (reads process.env; exit 1 and ::error:: lines on a problem)
import { pathToFileURL } from "node:url";

const LABEL = "[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?";
const HOSTNAME = new RegExp(`^(?=.{1,253}$)${LABEL}(?:\\.${LABEL})*$`);
const IPV6 = /^[0-9A-Fa-f:]*:[0-9A-Fa-f:.]*$/;

/** @type {Record<string, { required: boolean, valid: (v: string) => boolean, rule: string }>} */
const RULES = {
  DEPLOY_HOST: { required: true, valid: (v) => HOSTNAME.test(v) || IPV6.test(v), rule: "a hostname, IPv4 or IPv6 address" },
  DEPLOY_USER: { required: true, valid: (v) => /^[a-z_][a-z0-9_.-]{0,31}$/i.test(v), rule: "a Unix user name" },
  DEPLOY_PORT: { required: true, valid: (v) => /^\d{1,5}$/.test(v) && +v >= 1 && +v <= 65535, rule: "a port number 1-65535" },
  DEPLOY_PATH: {
    required: true,
    valid: (v) => /^\/[A-Za-z0-9._/-]+$/.test(v) && !v.split("/").includes(".."),
    rule: "an absolute path of letters, digits, . _ - / (no spaces, quotes or ..)",
  },
  SHA: { required: true, valid: (v) => /^[0-9a-f]{40}$/.test(v), rule: "a full 40-character commit hash" },
  // Optional: the public health check runs only when it is set.
  WEB_DOMAIN: { required: false, valid: (v) => HOSTNAME.test(v) && v.includes("."), rule: "a bare hostname (no scheme, port or path)" },
};

/**
 * Problems with the deploy configuration in `env`, one message per variable; empty when it is usable.
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
export function deployEnvProblems(env) {
  const problems = [];
  for (const [name, { required, valid, rule }] of Object.entries(RULES)) {
    const value = env[name] ?? "";
    if (value === "") {
      if (required) problems.push(`${name} is not set`);
    } else if (!valid(value)) problems.push(`${name} must be ${rule}`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = deployEnvProblems(process.env);
  for (const p of problems) console.log(`::error title=Deploy configuration::${p}`);
  if (problems.length) process.exit(1);
  console.log("deploy configuration ok");
}
