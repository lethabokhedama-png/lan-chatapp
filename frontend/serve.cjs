const https = require("https");
const fs    = require("fs");
const path  = require("path");

const CERT = path.join(__dirname, "../cert.pem");
const KEY  = path.join(__dirname, "../key.pem");
const DIST = path.join(__dirname, "dist");
const PORT = 5173;

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".mp3":  "audio/mpeg",
  ".json": "application/json",
  ".ico":  "image/x-icon",
  ".webm": "audio/webm",
};

const opts = {
  key:  fs.readFileSync(KEY),
  cert: fs.readFileSync(CERT),
};

const server = https.createServer(opts, (req, res) => {
  let filePath = path.join(DIST, req.url === "/" ? "index.html" : req.url);

  // Remove query strings
  filePath = filePath.split("?")[0];

  if (!fs.existsSync(filePath)) {
    // SPA fallback
    filePath = path.join(DIST, "index.html");
  }

  const ext  = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  } catch (_) {
    res.writeHead(404);
    res.end("Not found");
  }
});

// Get LAN IP
const os   = require("os");
const nets = os.networkInterfaces();
let ip     = "127.0.0.1";
for (const ifaces of Object.values(nets)) {
  for (const iface of ifaces) {
    if (iface.family === "IPv4" && !iface.internal) {
      ip = iface.address;
      break;
    }
  }
}

server.listen(PORT, "0.0.0.0", () => {
  console.log("\n  LAN Chat Frontend — HTTPS only");
  console.log(`  https://localhost:${PORT}`);
  console.log(`  https://${ip}:${PORT}\n`);
});
