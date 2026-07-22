import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const children = [];
const frontendEnv = readFrontendEnv();

function readFrontendEnv() {
  try {
    return Object.fromEntries(
      readFileSync(new URL("./.env", import.meta.url), "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const separatorIndex = line.indexOf("=");
          return [
            line.slice(0, separatorIndex),
            line.slice(separatorIndex + 1).replace(/^["']|["']$/g, ""),
          ];
        }),
    );
  } catch {
    return {};
  }
}

function run(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
    },
    shell: false,
    stdio: ["inherit", "pipe", "pipe"],
  });

  children.push(child);

  child.stdout.on("data", (data) => {
    process.stdout.write(`[${name}] ${data}`);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(`[${name}] ${data}`);
  });

  child.on("exit", (code, signal) => {
    if (signal || code === 0) {
      return;
    }

    console.error(`[${name}] exited with code ${code}`);
    shutdown(code || 1);
  });

  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    process.exit(code);
  }, 100);
}

process.on("SIGINT", () => {
  shutdown(0);
});

process.on("SIGTERM", () => {
  shutdown(0);
});

run("api", "node", ["server.mjs"], {
  cwd: new URL("../backend", import.meta.url),
  env: {
    ADMIN_CODE: process.env.ADMIN_CODE || frontendEnv.VITE_ADMIN_CODE,
  },
});
run("web", "node", ["node_modules/vite/bin/vite.js"]);
