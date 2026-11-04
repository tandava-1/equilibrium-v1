import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const files = {
  "/": "index.html",
  "/index.html": "index.html",
  "/app.js": "app.js",
  "/styles.css": "styles.css",
  "/model.js": "model.js",
  "/ai.js": "ai.js",
  "/daily.js": "daily.js",
  "/messages.js": "messages.js",
  "/sw.js": "sw.js",
  "/manifest.webmanifest": "manifest.webmanifest",
  "/icon-192.png": "icon-192.png",
  "/icon-512.png": "icon-512.png",
  "/apple-touch-icon.png": "apple-touch-icon.png",
};
const types = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  webmanifest: "application/manifest+json; charset=utf-8",
  png: "image/png",
};
createServer(async (req, res) => {
  const file = files[new URL(req.url, "http://localhost").pathname];
  if (!file) {
    res.writeHead(404);
    return res.end("Not found");
  }
  try {
    const body = await readFile(new URL(`./dist/${file}`, import.meta.url));
    res.writeHead(200, {
      "Content-Type": types[file.split(".").pop()],
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end("Unable to load app");
  }
}).listen(4173, process.env.HOST || "127.0.0.1", () =>
  console.log("Equilibrium: http://127.0.0.1:4173"),
);
