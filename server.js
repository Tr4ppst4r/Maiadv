import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { attachRooms } from "./rooms.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const production = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT) || 5173;
const server = http.createServer();
const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
attachRooms(wss);
server.on("upgrade", (request, socket, head) => {
  if (request.url !== "/party") return;
  const origin = request.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.host) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
    } catch {
      socket.destroy();
      return;
    }
  }
  wss.handleUpgrade(request, socket, head, (ws) =>
    wss.emit("connection", ws, request),
  );
});
if (!production) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true, hmr: { server } },
    appType: "spa",
  });
  server.on("request", vite.middlewares);
} else {
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".json": "application/json",
    ".woff2": "font/woff2",
  };
  server.on("request", (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    const dist = path.join(root, "dist");
    let file = path.resolve(dist, "." + pathname);
    if (file !== dist && !file.startsWith(dist + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
      file = path.join(dist, "index.html");
    if (!fs.existsSync(file)) {
      res.writeHead(503);
      res.end("Build the game with npm run build first.");
      return;
    }
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Cache-Control",
      file.includes("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    );
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(file).pipe(res);
  });
}
server.listen(port, "0.0.0.0", () =>
  console.log(
    `Maisie's Magic Kingdom is listening on port ${port} (${production ? "production" : "development"}).`,
  ),
);
function shutdown() {
  for (const c of wss.clients) c.close();
  wss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
