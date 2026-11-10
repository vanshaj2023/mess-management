const express = require('express');
const rateLimit = require('express-rate-limit');
const { col } = require('../db');
const { problem, isDuplicateKey } = require('../errors');
const { parse, registerSchema, loginSchema } = require('../validation');
const { hashPassword, verifyPassword, burnPasswordTime, startSession, endSession, requireAuth } = require('../auth');
const { toUser } = require('../serializers');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 15,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many failed attempts. Try again in a few minutes.', code: 'RATE_LIMITED' });
  },
});

router.post('/auth/register', async (req, res) => {
  const data = parse(registerSchema, req.body);
  const isStaff = data.category === 'staff';
  const forcedMess = isStaff ? null : data.year === 1 ? 'PB' : data.year === 2 ? 'GF' : null;

  const user = {
    _id: data.id,
    name: data.name,
    role: 'member',
    category: data.category,
    year: isStaff ? null : data.year,
    email: data.email,
    phone: data.phone,
    passwordHash: await hashPassword(data.password),
    mess: forcedMess ?? 'NONE',
    fpEnrolled: false,
    createdAt: new Date(req.nowMs).toISOString(),
    updatedAt: new Date(req.nowMs).toISOString(),
    lastLoginAt: new Date(req.nowMs).toISOString(),
    loginCount: 1,
  };

  try {
    await col('users').insertOne(user);
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    if (error.keyPattern?.email) throw problem('EMAIL_TAKEN', 'Please fix the highlighted fields.', { email: 'This email is already registered.' });
    throw problem('ID_TAKEN', 'Please fix the highlighted fields.', { id: 'This ID is already registered.' });
  }

  await startSession(res, user._id);
  res.status(201).json({ user: toUser(user) });
});

router.post('/auth/login', loginLimiter, async (req, res) => {
  const { id, password } = parse(loginSchema, req.body);
  const user = await col('users').findOne({ _id: id });
  const valid = user ? await verifyPassword(password, user.passwordHash) : (await burnPasswordTime(password), false);
  if (!valid) throw problem('INVALID_CREDENTIALS', 'ID or password is incorrect.');

  await col('users').updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date(req.nowMs).toISOString() }, $inc: { loginCount: 1 } });
  await startSession(res, user._id);
  res.json({ user: toUser(user) });
});

router.post('/auth/logout', async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: toUser(req.user) });
});

module.exports = router;
