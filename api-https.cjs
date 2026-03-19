const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");
const os    = require("os");

const CERT = path.join(__dirname, "cert.pem");
const KEY  = path.join(__dirname, "key.pem");
const PORT = 8443;

// Auto-detect LAN IP
function getLanIp() {
  const nets = os.networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "0.0.0.0";
}

const IP = getLanIp();

const server = https.createServer({
  key:  fs.readFileSync(KEY),
  cert: fs.readFileSync(CERT),
}, (req, res) => {
  // Forward to Flask
  const opts = {
    hostname: "127.0.0.1",
    port: 8000,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: "127.0.0.1:8000" },
  };
  const proxy = http.request(opts, r => {
    res.writeHead(r.statusCode, {
      ...r.headers,
      "access-control-allow-origin":  "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    });
    r.pipe(res);
  });
  proxy.on("error", () => { res.writeHead(502); res.end("API unavailable"); });
  req.pipe(proxy);
});

server.listen(PORT, IP, () => {
  console.log(`  [API-HTTPS] https://${IP}:${PORT} -> http://127.0.0.1:8000`);
});
