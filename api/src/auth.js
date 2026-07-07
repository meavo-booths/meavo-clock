import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import db from './db.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const SESSION_COOKIE = 'meavo_session';
const SESSION_DAYS = 7;

function getAllowedEmails() {
  const fromDb = db.prepare('SELECT email FROM admin_allowlist').all().map((r) => r.email.toLowerCase());
  const fromEnv =
    process.env.ALLOWED_ADMIN_EMAILS?.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean) ?? [];
  return new Set([...fromDb, ...fromEnv]);
}

export function isEmailAllowed(email) {
  const allowed = getAllowedEmails();
  if (allowed.size === 0) return false;
  return allowed.has(email.toLowerCase());
}

export async function verifyGoogleCredential(credential) {
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) throw Object.assign(new Error('No email in token'), { status: 401 });
  if (!payload.email_verified) {
    throw Object.assign(new Error('Email not verified'), { status: 401 });
  }
  if (!isEmailAllowed(payload.email)) {
    throw Object.assign(new Error('Email not authorized'), { status: 403 });
  }
  return { email: payload.email, name: payload.name, picture: payload.picture };
}

export function createSessionToken(user) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET not configured');
  return jwt.sign(user, secret, { expiresIn: `${SESSION_DAYS}d` });
}

export function verifySessionToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return null;
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

export function setSessionCookie(res, token) {
  const secure =
    process.env.COOKIE_SECURE === '1' ||
    (process.env.COOKIE_SECURE !== '0' && process.env.NODE_ENV === 'production');
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  const secure =
    process.env.COOKIE_SECURE === '1' ||
    (process.env.COOKIE_SECURE !== '0' && process.env.NODE_ENV === 'production');
  res.clearCookie(SESSION_COOKIE, { path: '/', secure });
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}
