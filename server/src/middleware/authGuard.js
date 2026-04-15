const { verifyToken } = require("../utils/authToken");

const parseBearerToken = (authorizationHeader) => {
  const raw = String(authorizationHeader || "").trim();
  if (!raw.toLowerCase().startsWith("bearer ")) {
    return "";
  }
  return raw.slice(7).trim();
};

const requireAuth = (req, res, next) => {
  try {
    const token = parseBearerToken(req.headers?.authorization);
    if (!token) {
      return res.status(401).json({ ok: false, message: "Authorization token required", error: "UNAUTHORIZED" });
    }

    const payload = verifyToken(token);
    req.auth = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ ok: false, message: "Invalid or expired token", error: "UNAUTHORIZED" });
  }
};

const requireRoles = (allowedRoles = []) => (req, res, next) => {
  const role = String(req.auth?.role || "");
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({ ok: false, message: "Insufficient role privileges", error: "FORBIDDEN" });
  }
  return next();
};

module.exports = {
  requireAuth,
  requireRoles,
};
