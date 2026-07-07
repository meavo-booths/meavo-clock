import { verifySessionToken, getSessionCookieName, isEmailAllowed } from './auth.js';

export function deviceAuth(req, res, next) {
  const key = req.headers['x-device-key'];
  const expected = process.env.DEVICE_API_KEY;
  if (!expected || key !== expected) {
    return res.status(401).json({ error: 'Invalid device API key' });
  }
  next();
}

export function adminAuth(req, res, next) {
  const token = req.cookies?.[getSessionCookieName()];
  const user = verifySessionToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Re-check the allowlist on every request so removing an admin takes
  // effect immediately rather than when their session token expires.
  if (!isEmailAllowed(user.email)) {
    return res.status(401).json({ error: 'Access revoked' });
  }
  req.user = user;
  next();
}

export function optionalAdminAuth(req, _res, next) {
  const token = req.cookies?.[getSessionCookieName()];
  req.user = verifySessionToken(token);
  next();
}
