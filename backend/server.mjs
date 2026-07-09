import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number.parseInt(process.env.PORT || "5174", 10);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT_DIR = fileURLToPath(new URL(".", import.meta.url));
const STORAGE_DIR = process.env.STORAGE_DIR ? resolve(process.env.STORAGE_DIR) : ROOT_DIR;
const DATA_DIR = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : resolve(STORAGE_DIR, "data");
const VIDEO_DIR = process.env.VIDEO_DIR ? resolve(process.env.VIDEO_DIR) : resolve(STORAGE_DIR, "public");
const COUNT_FILE = resolve(DATA_DIR, "view-count.json");
const VIDEO_FILE = resolve(VIDEO_DIR, "office-tour.mp4");
const ADMIN_CODE = process.env.ADMIN_CODE || "bitbyte123";
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const PUBLIC_VIDEO_URL = process.env.PUBLIC_VIDEO_URL || "";
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

let storeQueue = Promise.resolve();

function wildcardToRegExp(pattern) {
  const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escapedPattern.replaceAll("*", ".*")}$`);
}

function matchesAllowedOrigin(origin, allowedOrigin) {
  return allowedOrigin.includes("*")
    ? wildcardToRegExp(allowedOrigin).test(origin)
    : origin === allowedOrigin;
}

function getAllowedOrigin(request) {
  if (allowedOrigins.includes("*")) {
    return "*";
  }

  const requestOrigin = request.headers.origin;
  const matchedOrigin = requestOrigin
    ? allowedOrigins.find((allowedOrigin) => matchesAllowedOrigin(requestOrigin, allowedOrigin))
    : "";

  return matchedOrigin ? requestOrigin : allowedOrigins[0];
}

function corsHeaders(request) {
  return {
    "Access-Control-Allow-Headers": "Content-Type,X-Admin-Code",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": getAllowedOrigin(request),
    "Vary": "Origin",
  };
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    ...corsHeaders(response.req),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function sendEmpty(request, response, statusCode) {
  response.writeHead(statusCode, {
    ...corsHeaders(request),
  });
  response.end();
}

function isAdmin(request) {
  return request.headers["x-admin-code"] === ADMIN_CODE;
}

function requireAdmin(request, response) {
  if (isAdmin(request)) {
    return true;
  }

  sendJson(response, 401, { error: "Invalid admin code." });
  return false;
}

function readRequestBody(request, maxBytes) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let totalBytes = 0;

    request.on("data", (chunk) => {
      totalBytes += chunk.length;

      if (totalBytes > maxBytes) {
        rejectBody(new Error("Video file is too large."));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      resolveBody(Buffer.concat(chunks));
    });

    request.on("error", rejectBody);
  });
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

async function hasUploadedVideo() {
  try {
    const fileInfo = await stat(VIDEO_FILE);
    return fileInfo.isFile() && fileInfo.size > 0;
  } catch {
    return false;
  }
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
    sendEmpty(request, response, 204);
    return true;
  }

  if (url.pathname === "/health" && request.method === "GET") {
    sendJson(response, 200, { ok: true, service: "bitbyte-office-tour-api" });
    return true;
  }

  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, { count: await readCount(), ok: true });
    return true;
  }

  if (url.pathname === "/api/views" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, { count: await readCount() });
    return true;
  }

  if (url.pathname === "/api/views/increment" && request.method === "POST") {
    const count = await updateCount((currentCount) => currentCount + 1);
    sendJson(response, 200, { count });
    return true;
  }

  if (url.pathname === "/api/views/reset" && request.method === "POST") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    const count = await updateCount(() => 0);
    sendJson(response, 200, { count });
    return true;
  }

  if (url.pathname === "/api/video" && request.method === "GET") {
    const url = (await hasUploadedVideo()) ? "/video.mp4" : PUBLIC_VIDEO_URL;
    sendJson(response, 200, { url });
    return true;
  }

  if (url.pathname === "/api/video" && request.method === "POST") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    const contentType = request.headers["content-type"] || "";

    if (!contentType.startsWith("video/") && contentType !== "application/octet-stream") {
      sendJson(response, 400, { error: "Upload a video file." });
      return true;
    }

    const videoBuffer = await readRequestBody(request, MAX_VIDEO_BYTES);

    if (videoBuffer.length === 0) {
      sendJson(response, 400, { error: "Video file is empty." });
      return true;
    }

    await mkdir(VIDEO_DIR, { recursive: true });
    await writeFile(VIDEO_FILE, videoBuffer);

    sendJson(response, 200, { ok: true, url: `/video.mp4?v=${Date.now()}` });
    return true;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "API route not found." });
    return true;
  }

  return false;
}

async function serveVideo(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname !== "/video.mp4" || !["GET", "HEAD"].includes(request.method)) {
    return false;
  }

  let fileInfo;

  try {
    fileInfo = await stat(VIDEO_FILE);
  } catch {
    sendJson(response, 404, { error: "No office tour video has been uploaded yet." });
    return true;
  }

  const range = request.headers.range;
  const commonHeaders = {
    ...corsHeaders(request),
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Type": "video/mp4",
  };

  if (!range) {
    response.writeHead(200, {
      ...commonHeaders,
      "Content-Length": fileInfo.size,
    });
    if (request.method === "HEAD") {
      response.end();
      return true;
    }

    createReadStream(VIDEO_FILE).pipe(response);
    return true;
  }

  const match = range.match(/bytes=(\d*)-(\d*)/);

  if (!match) {
    response.writeHead(416, commonHeaders);
    response.end();
    return true;
  }

  const start = match[1] ? Number.parseInt(match[1], 10) : 0;
  const end = match[2] ? Number.parseInt(match[2], 10) : fileInfo.size - 1;

  if (start >= fileInfo.size || end >= fileInfo.size || start > end) {
    response.writeHead(416, {
      ...commonHeaders,
      "Content-Range": `bytes */${fileInfo.size}`,
    });
    response.end();
    return;
  }

  response.writeHead(206, {
    ...commonHeaders,
    "Content-Length": end - start + 1,
    "Content-Range": `bytes ${start}-${end}/${fileInfo.size}`,
  });
  if (request.method === "HEAD") {
    response.end();
    return true;
  }

  createReadStream(VIDEO_FILE, { end, start }).pipe(response);
  return true;
}

const server = createServer(async (request, response) => {
  response.req = request;

  try {
    const handled = await handleApi(request, response);

    if (handled) {
      return;
    }

    if (await serveVideo(request, response)) {
      return;
    }

    sendJson(response, 404, { error: "Route not found." });
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
