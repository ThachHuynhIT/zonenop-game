import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deployEnvProblems } from "./check-deploy-env.mjs";

const root = path.resolve(import.meta.dirname, "..");
const workflowsDir = path.join(root, ".github", "workflows");

/** Every `run:` script in a workflow file, with the step name and line it starts on (enough YAML for our files). */
function runBlocks(yml) {
  const lines = yml.split(/\r?\n/);
  const blocks = [];
  let step = "";
  for (let i = 0; i < lines.length; i++) {
    const named = lines[i].match(/^\s*- name:\s*(.*)$/);
    if (named) step = named[1];
    const m = lines[i].match(/^(\s*)(- )?run:\s*(.*)$/);
    if (!m) continue;
    const keyIndent = m[1].length + (m[2] ? 2 : 0);
    if (m[3] && !/^[|>][-+]?\s*(#.*)?$/.test(m[3])) {
      blocks.push({ step, line: i + 1, script: m[3] });
      continue;
    }
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === "") {
        body.push("");
        continue;
      }
      if (lines[j].match(/^\s*/)[0].length <= keyIndent) break;
      body.push(lines[j]);
    }
    const indent = Math.min(...body.filter(Boolean).map((l) => l.match(/^\s*/)[0].length));
    blocks.push({ step, line: i + 1, script: body.map((l) => l.slice(indent)).join("\n").trimEnd() + "\n" });
  }
  return blocks;
}

const workflows = readdirSync(workflowsDir).filter((f) => /\.ya?ml$/.test(f));
const deployYml = readFileSync(path.join(workflowsDir, "deploy.yml"), "utf8");
const deployBlocks = runBlocks(deployYml);

const GOOD = {
  DEPLOY_HOST: "phone.tail1234.ts.net",
  DEPLOY_USER: "deploy",
  DEPLOY_PORT: "22",
  DEPLOY_PATH: "/home/deploy/apps/zonenop-game",
  SHA: "0123456789abcdef0123456789abcdef01234567",
  WEB_DOMAIN: "play.fudio101.com",
};

describe("deployEnvProblems", () => {
  it("accepts a usable configuration, with or without WEB_DOMAIN, and IP hosts", () => {
    expect(deployEnvProblems(GOOD)).toEqual([]);
    expect(deployEnvProblems({ ...GOOD, WEB_DOMAIN: "" })).toEqual([]);
    expect(deployEnvProblems({ ...GOOD, DEPLOY_HOST: "100.64.1.2" })).toEqual([]);
    expect(deployEnvProblems({ ...GOOD, DEPLOY_HOST: "fd7a:115c:a1e0::1" })).toEqual([]);
    expect(deployEnvProblems({ ...GOOD, DEPLOY_PORT: "2222" })).toEqual([]);
  });

  it.each([
    ["DEPLOY_HOST", "host\n  ProxyCommand touch /tmp/pwned"],
    ["DEPLOY_HOST", "host name"],
    ["DEPLOY_HOST", "-oProxyCommand=x"],
    ["DEPLOY_USER", "deploy\nHost *"],
    ["DEPLOY_USER", "root;id"],
    ["DEPLOY_PORT", "22 -oProxyCommand=x"],
    ["DEPLOY_PORT", "0"],
    ["DEPLOY_PORT", "70000"],
    ["DEPLOY_PATH", "relative/path"],
    ["DEPLOY_PATH", "/home/deploy/it's"],
    ["DEPLOY_PATH", "/home/deploy/$(id)"],
    ["DEPLOY_PATH", "/home/deploy/../root"],
    ["DEPLOY_PATH", "C:/Program Files/Git/home/deploy"],
    ["SHA", "main"],
    ["SHA", "0123456789abcdef0123456789abcdef01234567; id"],
    ["WEB_DOMAIN", "https://play.fudio101.com"],
    ["WEB_DOMAIN", "play.fudio101.com/api"],
    ["WEB_DOMAIN", "play.fudio101.com:8443"],
    ["WEB_DOMAIN", "x$(id).com"],
    ["WEB_DOMAIN", "localhost"],
  ])("refuses %s = %j and names only the variable", (name, value) => {
    const problems = deployEnvProblems({ ...GOOD, [name]: value });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(new RegExp(`^${name} must be `));
    expect(problems[0]).not.toContain(value);
  });

  it("reports every missing required value", () => {
    expect(deployEnvProblems({})).toEqual(["DEPLOY_HOST", "DEPLOY_USER", "DEPLOY_PORT", "DEPLOY_PATH", "SHA"].map((n) => `${n} is not set`));
  });
});

describe("workflows never interpolate ${{ }} into a run: script", () => {
  it("finds the deploy scripts (the check is not vacuous)", () => {
    const steps = deployBlocks.map((b) => b.step);
    for (const s of ["Validate configuration", "Prepare SSH", "Upload the release", "Build and restart on the server", "Public health check"])
      expect(steps).toContain(s);
  });

  it.each(workflows)("%s", (file) => {
    const bad = runBlocks(readFileSync(path.join(workflowsDir, file), "utf8"))
      .filter((b) => b.script.includes("${{"))
      .map((b) => `${file}:${b.line} (${b.step})`);
    expect(bad).toEqual([]);
  });

  it("the deploy job validates its configuration before any step uses it", () => {
    const order = deployBlocks.map((b) => b.step);
    expect(order.indexOf("Validate configuration")).toBeLessThan(order.indexOf("Prepare SSH"));
    expect(deployBlocks.find((b) => b.step === "Validate configuration").script.trim()).toBe("node scripts/check-deploy-env.mjs");
  });
});

// Runs the real "Prepare SSH" script from deploy.yml in bash (CI runs on Ubuntu; skipped on Windows).
describe.skipIf(process.platform === "win32")("Prepare SSH keeps secrets literal", () => {
  let home = "";
  afterEach(() => {
    if (home) rmSync(home, { recursive: true, force: true });
  });

  const prepare = deployBlocks.find((b) => b.step === "Prepare SSH").script;

  function run(script, extraEnv) {
    home = mkdtempSync(path.join(tmpdir(), "deploy-ssh-"));
    const sentinel = path.join(home, "SENTINEL");
    const hostile = [
      "-----BEGIN OPENSSH PRIVATE KEY-----",
      `line with "double" and 'single' quotes`,
      `dollar-paren $(touch ${sentinel}) and backtick \`touch ${sentinel}\``,
      "dollar $HOME and ${HOME} and \\ backslash",
      "-----END OPENSSH PRIVATE KEY-----",
    ].join("\n");
    const knownHosts = `phone.tail1234.ts.net ssh-ed25519 AAAAC3Nz$(touch ${sentinel})`;
    const res = spawnSync("bash", ["-eo", "pipefail", "-c", script(hostile, knownHosts)], {
      env: { PATH: process.env.PATH, HOME: home, ...GOOD, DEPLOY_SSH_KEY: hostile, DEPLOY_KNOWN_HOSTS: knownHosts, ...extraEnv },
      encoding: "utf8",
    });
    return { res, sentinel, hostile, knownHosts };
  }

  it("writes the key and known_hosts byte for byte, mode 600, and runs nothing inside them", () => {
    const { res, sentinel, hostile, knownHosts } = run(() => prepare);
    expect(res.status, res.stderr).toBe(0);
    expect(readFileSync(path.join(home, ".ssh", "id_deploy"), "utf8")).toBe(hostile + "\n");
    expect(readFileSync(path.join(home, ".ssh", "known_hosts"), "utf8")).toBe(knownHosts + "\n");
    expect(statSync(path.join(home, ".ssh", "id_deploy")).mode & 0o777).toBe(0o600);
    expect(statSync(path.join(home, ".ssh")).mode & 0o777).toBe(0o700);
    const config = readFileSync(path.join(home, ".ssh", "config"), "utf8");
    expect(config).toContain(`HostName ${GOOD.DEPLOY_HOST}\n`);
    expect(config).toContain("StrictHostKeyChecking yes\n");
    expect(existsSync(sentinel)).toBe(false);
    expect(res.stdout + res.stderr).not.toContain("OPENSSH");
  });

  it("the old pattern (${{ secrets.X }} pasted into the script) would have run the payload", () => {
    // What Actions did before: substitute the secret's text into the script, then run it.
    const { sentinel } = run((key, hosts) => prepare.replace('"$DEPLOY_SSH_KEY"', () => `"${key}"`).replace('"$DEPLOY_KNOWN_HOSTS"', () => `"${hosts}"`));
    expect(existsSync(sentinel)).toBe(true);
  });
});
