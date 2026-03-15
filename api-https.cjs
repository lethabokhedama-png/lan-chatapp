const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");

const CERT = path.join(__dirname, "cert.pem");
const KEY  = path.join(__dirname, "key.pem");
const PORT = 8443;
const API  = "http://127.0.0.1:8000";

const opts = {
  key:  fs.readFileSync(KEY),
  cert: fs.readFileSync(CERT),
};

https.createServer(opts, (req, res) => {
  const options = {
    hostname: "127.0.0.1",
    port: 8000,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: "127.0.0.1:8000" },
  };

  const proxy = http.request(options, (r) => {
    res.writeHead(r.statusCode, {
      ...r.headers,
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    });
    r.pipe(res);
  });

  proxy.on("error", () => {
    res.writeHead(502);
    res.end("API unavailable");
  });

  req.pipe(proxy);
}).listen(PORT, "0.0.0.0", () => {
  console.log(`  [API-HTTPS] https://0.0.0.0:${PORT} -> http://127.0.0.1:8000`);
});
