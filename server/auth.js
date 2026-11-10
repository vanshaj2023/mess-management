const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { env } = require('./config');
const { col } = require('./db');
const { ApiError, problem } = require('./errors');

const scrypt = promisify(crypto.scrypt);
const COOKIE_NAME = 'sid';
const KEY_LENGTH = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

let decoyHash = null;

async function burnPasswordTime(password) {
  decoyHash ??= await hashPassword('decoy-password-for-timing');
  await verifyPassword(password, decoyHash);
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const sessionMaxAgeMs = () => env.sessionTtlDays * 86400000;

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProduction,
  path: '/',
});

async function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await col('sessions').insertOne({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + sessionMaxAgeMs()),
  });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: sessionMaxAgeMs() });
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

async function endSession(req, res) {
  const token = readCookie(req, COOKIE_NAME);
  if (token && token.length < 100) await col('sessions').deleteOne({ tokenHash: hashToken(token) });
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

async function loadSession(req, res, next) {
  req.user = null;
  const token = readCookie(req, COOKIE_NAME);
  if (token && token.length < 100) {
    const session = await col('sessions').findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
    if (session) req.user = await col('users').findOne({ _id: session.userId });
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) throw new ApiError(401, 'Sign in required', 'UNAUTHENTICATED');
  next();
}

const requireRole = (role) => (req, res, next) => {
  if (!req.user) throw new ApiError(401, 'Sign in required', 'UNAUTHENTICATED');
  if (req.user.role !== role) throw problem('FORBIDDEN', 'You do not have access to this.');
  next();
};

function sameOriginOnly(req, res, next) {
  const origin = req.get('origin');
  if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    let host = null;
    try {
      host = new URL(origin).host;
    } catch {
      host = null;
    }
    if (host !== req.get('host')) throw problem('FORBIDDEN', 'Cross-origin request blocked.');
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  burnPasswordTime,
  startSession,
  endSession,
  loadSession,
  requireAuth,
  requireRole,
  sameOriginOnly,
};
