import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

const buildRoots = [path.resolve(".output"), path.resolve("dist")];
const serverEntry = [
  ...buildRoots.map((root) => path.join(root, "server", "index.mjs")),
  ...buildRoots.map((root) => path.join(root, "server", "index.js")),
].find((filePath) => fs.existsSync(filePath));
const clientDir = [
  path.join(buildRoots[0], "public"),
  path.join(buildRoots[1], "client"),
].find((directory) => fs.existsSync(directory));

if (!serverEntry || !clientDir) {
  console.error("Build output not found. Run npm run build first.");
  process.exit(1);
}

const serverModule = await import(serverEntry);
const handler = serverModule.default ?? serverModule;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function getPort() {
  const portIndex = process.argv.indexOf("--port");
  const requestedPort = portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT;
  return Number.parseInt(requestedPort ?? "3000", 10);
}

function getHost() {
  const hostIndex = process.argv.indexOf("--host");
  return hostIndex >= 0 ? process.argv[hostIndex + 1] ?? "0.0.0.0" : "0.0.0.0";
}

function getStaticFile(pathname) {
  if (pathname === "/" || pathname.endsWith("/")) return undefined;

  const filePath = path.resolve(clientDir, `.${pathname}`);
  if (!filePath.startsWith(`${clientDir}${path.sep}`)) return undefined;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return undefined;
  return filePath;
}

async function toWebRequest(req) {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

async function writeWebResponse(res, webResponse) {
  res.statusCode = webResponse.status;
  for (const [key, value] of webResponse.headers) res.setHeader(key, value);

  if (!webResponse.body) {
    res.end();
    return;
  }

  const reader = webResponse.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    let pathname;
    try {
      pathname = decodeURIComponent(requestUrl.pathname);
    } catch {
      res.statusCode = 400;
      res.end("Bad request");
      return;
    }

    const staticFile = getStaticFile(pathname);
    if (staticFile) {
      const extension = path.extname(staticFile).toLowerCase();
      res.setHeader("Content-Type", contentTypes[extension] ?? "application/octet-stream");
      if (pathname.startsWith("/assets/")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
      fs.createReadStream(staticFile).pipe(res);
      return;
    }

    const webResponse = await handler.fetch(await toWebRequest(req), {}, {
      waitUntil: (promise) => Promise.resolve(promise).catch(console.error),
    });
    await writeWebResponse(res, webResponse);
  } catch (error) {
    console.error("SSR request failed:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Internal Server Error");
  }
});

server.listen(getPort(), getHost(), () => {
  console.log(`RIZZ server listening on port ${getPort()}`);
});