const crypto = require("crypto");
const fs     = require("fs");
const path   = require("path");

function loadSecret() {
  const p = path.join(__dirname, "../../../DATA/secret.key");
  try { return fs.readFileSync(p, "utf8").trim(); } catch (_) { return ""; }
}

function verifyToken(token) {
  const secret = loadSecret();
  if (!secret || !token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [, payload, sig] = parts;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(parts[0] + "." + payload)
      .digest("hex");
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, "base64").toString());
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch (_) { return null; }
}

module.exports = function authMiddleware(socket, next) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  const data  = verifyToken(token);
  if (!data) {
    return next(new Error("Unauthorized"));
  }
  socket.uid      = data.uid || data.sub;
  socket.username = data.username || String(socket.uid);
  next();
};
