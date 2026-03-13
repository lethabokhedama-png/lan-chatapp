const crypto = require("crypto");
const cfg    = require("../config");

const TOKEN_TTL_MS = 86400 * 1000;

function verifyToken(token) {
  try {
    if (!token) { console.log("[AUTH-DEBUG] No token provided"); return null; }

    console.log("[AUTH-DEBUG] Token received:", token.slice(0, 40) + "...");
    console.log("[AUTH-DEBUG] Secret (first 8 chars):", cfg.SECRET.slice(0, 8));

    const lastDot = token.lastIndexOf(".");
    const payload = token.slice(0, lastDot);
    const sig     = token.slice(lastDot + 1);

    console.log("[AUTH-DEBUG] Payload:", payload.slice(0, 30) + "...");
    console.log("[AUTH-DEBUG] Sig received:", sig.slice(0, 16) + "...");

    const expected = crypto
      .createHmac("sha256", cfg.SECRET)
      .update(payload)
      .digest("hex");

    console.log("[AUTH-DEBUG] Sig expected:", expected.slice(0, 16) + "...");
    console.log("[AUTH-DEBUG] Match:", sig === expected);

    if (sig.length !== expected.length) {
      console.log("[AUTH-DEBUG] Length mismatch:", sig.length, "vs", expected.length);
      return null;
    }

    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }

    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    console.log("[AUTH-DEBUG] Decoded uid:", data.uid, "age_ms:", Date.now() - (data.ts || 0));

    if (Date.now() - (data.ts || 0) > TOKEN_TTL_MS) {
      console.log("[AUTH-DEBUG] Token expired");
      return null;
    }
    return data.uid;
  } catch (e) {
    console.log("[AUTH-DEBUG] Exception:", e.message);
    return null;
  }
}

module.exports = { verifyToken };
