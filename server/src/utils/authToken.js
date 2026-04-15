const crypto = require("crypto");

const SECRET = String(process.env.AUTH_TOKEN_SECRET || "saferide-dev-secret");
const EXPIRY_MS = Number(process.env.AUTH_TOKEN_EXPIRY_MS || 24 * 60 * 60 * 1000);

const base64UrlEncode = (value) => Buffer.from(value).toString("base64url");
const base64UrlDecode = (value) => Buffer.from(String(value || ""), "base64url").toString("utf8");

const signToken = (payload = {}) => {
  const body = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + EXPIRY_MS,
  };

  const encoded = base64UrlEncode(JSON.stringify(body));
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
};

const verifyToken = (token) => {
  if (!token || !String(token).includes(".")) {
    throw new Error("Invalid token format");
  }

  const [encoded, signature] = String(token).split(".");
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(encoded)
    .digest("base64url");

  if (signature !== expected) {
    throw new Error("Invalid token signature");
  }

  const payload = JSON.parse(base64UrlDecode(encoded));
  if (!payload?.exp || Date.now() > Number(payload.exp)) {
    throw new Error("Token expired");
  }

  return payload;
};

module.exports = {
  signToken,
  verifyToken,
};
