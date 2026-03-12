/**
 * Token verification — mirrors DataHandling's HMAC logic so the
 * realtime server can validate tokens without a round-trip to the API.
 *
 * Token format: <base64url_payload>.<hex_sig>
 */
const crypto = require("crypto");
const { SECRET } = require("../config");

const TOKEN_TTL_MS = 86400 * 1000; // 24 h

function verifyToken(token) {
  try {
    const lastDot = token.lastIndexOf(".");
    const payload = token.slice(0, lastDot);
    const sig     = token.slice(lastDot + 1);

    const expected = crypto
      .createHmac("sha256", SECRET)
      .update(payload)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }

    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (Date.now() - (data.ts || 0) > TOKEN_TTL_MS) return null;
    return data.uid;
  } catch {
    return null;
  }
}

module.exports = { verifyToken };