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
    // Python creates 2-part tokens: base64payload.hexsig
    const lastDot = token.lastIndexOf(".");
    if (lastDot === -1) return null;

    const payload = token.slice(0, lastDot);
    const sig     = token.slice(lastDot + 1);

    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    if (sig !== expected) return null;

    // Decode base64 payload
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch (_) { return null; }
}

module.exports = function authMiddleware(socket, next) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  const data  = verifyToken(token);
  if (!data) {
    console.log("[AUTH] REJECTED — invalid token");
    return next(new Error("Unauthorized"));
  }
  socket.uid      = data.uid;
  socket.username = data.username || String(data.uid);
  console.log(`[AUTH] OK — uid=${socket.uid}`);
  next();
};
