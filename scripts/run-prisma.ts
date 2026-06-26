import { spawnSync } from "child_process";
import { ensureDatabaseUrl } from "../src/lib/database-url";

ensureDatabaseUrl();

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: tsx --env-file=.env scripts/run-prisma.ts <prisma-args...>");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
