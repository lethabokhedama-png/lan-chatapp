const https  = require("https");
const http   = require("http");
const net    = require("net");
const fs     = require("fs");
const path   = require("path");
const os     = require("os");

const CERT = path.join(__dirname, "cert.pem");
const KEY  = path.join(__dirname, "key.pem");
const PORT = 6443;

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
  const opts = {
    hostname: "127.0.0.1",
    port: 6767,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: "127.0.0.1:6767" },
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
  proxy.on("error", () => { res.writeHead(502); res.end("RT unavailable"); });
  req.pipe(proxy);
});

// WebSocket tunnel — critical for Socket.IO
server.on("upgrade", (req, socket, head) => {
  const conn = net.connect(6767, "127.0.0.1", () => {
    conn.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
      Object.entries(req.headers).map(([k,v]) => `${k}: ${v}`).join("\r\n") +
      "\r\n\r\n"
    );
    conn.write(head);
    socket.pipe(conn).pipe(socket);
  });
  conn.on("error", () => socket.destroy());
  socket.on("error", () => conn.destroy());
});

server.listen(PORT, IP, () => {
  console.log(`  [RT-HTTPS] https://${IP}:${PORT} -> http://127.0.0.1:6767`);
});
