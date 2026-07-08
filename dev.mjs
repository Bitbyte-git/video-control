import { spawn } from "node:child_process";

const children = [];

function run(name, command, args, options = {}) {
  const child = spawn(command, args, {
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

run("api", "node", ["server.mjs"]);
run("web", "node", ["node_modules/vite/bin/vite.js"]);
