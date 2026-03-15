const https  = require("https");
const http   = require("http");
const fs     = require("fs");
const path   = require("path");
const { createProxyServer } = require("http-proxy");

const CERT = path.join(__dirname, "cert.pem");
const KEY  = path.join(__dirname, "key.pem");
const PORT = 6443;

const proxy = createProxyServer({
  target: "http://127.0.0.1:6767",
  ws: true,
  secure: false,
});

const server = https.createServer({
  key:  fs.readFileSync(KEY),
  cert: fs.readFileSync(CERT),
}, (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "*");
  proxy.web(req, res);
});

server.on("upgrade", (req, socket, head) => {
  proxy.ws(req, socket, head);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`  [RT-HTTPS] https://0.0.0.0:${PORT} -> http://127.0.0.1:6767`);
});
