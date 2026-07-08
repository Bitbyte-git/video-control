import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number.parseInt(process.env.PORT || "5174", 10);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT_DIR = fileURLToPath(new URL(".", import.meta.url));
const DIST_DIR = resolve(ROOT_DIR, "dist");
const DATA_DIR = resolve(ROOT_DIR, "data");
const COUNT_FILE = resolve(DATA_DIR, "view-count.json");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
};

let storeQueue = Promise.resolve();

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function sendEmpty(response, statusCode) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end();
}

async function readCount() {
  try {
    const rawStore = await readFile(COUNT_FILE, "utf8");
    const store = JSON.parse(rawStore);
    return Number.isInteger(store.count) && store.count >= 0 ? store.count : 0;
  } catch {
    return 0;
  }
}

async function writeCount(count) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(COUNT_FILE, `${JSON.stringify({ count }, null, 2)}\n`);
}

function updateCount(updater) {
  const nextOperation = storeQueue
    .catch(() => undefined)
    .then(async () => {
      const currentCount = await readCount();
      const nextCount = updater(currentCount);
      await writeCount(nextCount);
      return nextCount;
    });

  storeQueue = nextOperation;
  return nextOperation;
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    sendEmpty(response, 204);
    return true;
  }

  if (url.pathname === "/api/views" && request.method === "GET") {
    sendJson(response, 200, { count: await readCount() });
    return true;
  }

  if (url.pathname === "/api/views/increment" && request.method === "POST") {
    const count = await updateCount((currentCount) => currentCount + 1);
    sendJson(response, 200, { count });
    return true;
  }

  if (url.pathname === "/api/views/reset" && request.method === "POST") {
    const count = await updateCount(() => 0);
    sendJson(response, 200, { count });
    return true;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "API route not found." });
    return true;
  }

  return false;
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname);
  const filePath = resolve(
    DIST_DIR,
    requestedPath === "/" ? "index.html" : `.${requestedPath}`,
  );

  if (!filePath.startsWith(DIST_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const fileInfo = await stat(filePath);
    const finalPath = fileInfo.isDirectory() ? join(filePath, "index.html") : filePath;
    const extension = extname(finalPath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
    });
    response.end(await readFile(finalPath));
  } catch {
    const fallbackPath = resolve(DIST_DIR, "index.html");

    try {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
      });
      response.end(await readFile(fallbackPath));
    } catch {
      response.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end("Build the frontend first with npm run build.");
    }
  }
}

const server = createServer(async (request, response) => {
  try {
    const handled = await handleApi(request, response);

    if (!handled) {
      await serveStatic(request, response);
    }
  } catch {
    sendJson(response, 500, { error: "Server error." });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. The backend may already be running.`);
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`View count backend running at http://${HOST}:${PORT}`);
});
