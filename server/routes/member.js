const express = require('express');
const { ObjectId } = require('mongodb');
const { rules, MESSES } = require('../config');
const time = require('../time');
const { col } = require('../db');
const { problem, isDuplicateKey } = require('../errors');
const { requireRole } = require('../auth');
const { paymentRefOf } = require('../orders');
const { toUser, toSubscription, toCoupon, toBooking, toScan, toTransaction } = require('../serializers');
const {
  parse,
  messSchema,
  paymentOnlySchema,
  couponPurchaseSchema,
  bookingSchema,
  uniqueSlots,
} = require('../validation');
const {
  isSemesterMess,
  slotLabel,
  policyFor,
  currentSubscription,
  isSubscribed,
  mealPlanLock,
  createTransaction,
  removeTransaction,
  assertCouponPurchase,
  assertBooking,
} = require('../rules');

const router = express.Router();
const member = requireRole('member');

router.get('/me/data', member, async (req, res) => {
  const user = req.user;
  const windowStart = time.addDaysKey(time.dateKeyOf(req.nowMs), -30);
  const [subscriptions, coupons, bookings, scans, transactions, mealsEaten, paid] = await Promise.all([
    col('subscriptions').find({ userId: user._id }).sort({ paidAt: 1 }).toArray(),
    col('coupons').find({ userId: user._id, date: { $gte: windowStart } }).sort({ date: 1 }).toArray(),
    col('bookings').find({ userId: user._id, date: { $gte: windowStart } }).sort({ date: 1 }).toArray(),
    col('scans').find({ userId: user._id }).sort({ at: -1 }).limit(60).toArray(),
    col('transactions').find({ userId: user._id }).sort({ at: -1 }).toArray(),
    col('scans').countDocuments({ userId: user._id, result: 'served' }),
    col('transactions').aggregate([{ $match: { userId: user._id } }, { $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
  ]);

  res.json({
    user: toUser(user),
    subscriptions: subscriptions.map(toSubscription),
    coupons: coupons.map(toCoupon),
    bookings: bookings.map(toBooking),
    scans: scans.reverse().map(toScan),
    transactions: transactions.map(toTransaction),
    stats: { mealsEaten, totalPaid: paid[0]?.total ?? 0 },
  });
});

router.patch('/me/mess', member, async (req, res) => {
  const { mess } = parse(messSchema, req.body);
  const user = req.user;
  if (!policyFor(user).options.includes(mess)) throw problem('NOT_ALLOWED', 'That mess is not open to you.');
  if (mess !== user.mess) {
    const lock = await mealPlanLock(user, req.nowMs);
    if (lock) throw problem('PLAN_LOCKED', lock);
    const updatedAt = new Date(req.nowMs).toISOString();
    await col('users').updateOne({ _id: user._id }, { $set: { mess, updatedAt } });
    user.mess = mess;
  }
  res.json({ user: toUser(user) });
});

router.post('/me/subscription', member, async (req, res) => {
  const { payment } = parse(paymentOnlySchema, req.body);
  const user = req.user;
  const nowMs = req.nowMs;
  if (!isSemesterMess(user.mess)) throw problem('NOT_SEMESTER_MESS', 'Your mess does not use a semester plan.');
  if (await currentSubscription(user._id, nowMs)) throw problem('ALREADY_PAID', 'You have already paid for this semester.');

  const semester = time.semesterOf(nowMs);
  const transaction = await createTransaction(
    {
      userId: user._id,
      kind: 'semester',
      mess: user.mess,
      description: `${MESSES[user.mess].name}, ${semester.label}`,
      amount: rules.semesterFee,
      method: payment.method,
      paymentRef: paymentRefOf(payment),
      items: [{ label: `${semester.label} semester plan`, amount: rules.semesterFee }],
    },
    nowMs,
  );
  const subscription = {
    _id: new ObjectId(),
    userId: user._id,
    mess: user.mess,
    semesterId: semester.id,
    amount: rules.semesterFee,
    txnId: transaction._id,
    paidAt: transaction.at,
  };

  try {
    await col('subscriptions').insertOne(subscription);
  } catch (error) {
    await removeTransaction(transaction._id);
    if (isDuplicateKey(error)) throw problem('ALREADY_PAID', 'You have already paid for this semester.');
    throw error;
  }
  res.status(201).json({ transaction: toTransaction(transaction), subscription: toSubscription(subscription) });
});

router.post('/me/fingerprint', member, async (req, res) => {
  const user = req.user;
  if (!(await isSubscribed(user, req.nowMs))) throw problem('NOT_SUBSCRIBED', 'Pay the semester fee first.');
  const enrolledAt = new Date(req.nowMs).toISOString();
  await col('users').updateOne({ _id: user._id }, { $set: { fpEnrolled: true, fpEnrolledAt: enrolledAt, updatedAt: enrolledAt } });
  user.fpEnrolled = true;
  res.json({ user: toUser(user) });
});

router.post('/coupons', member, async (req, res) => {
  const body = parse(couponPurchaseSchema, req.body);
  const slots = uniqueSlots(body.slots);
  const user = req.user;
  const nowMs = req.nowMs;
  await assertCouponPurchase(user, slots, nowMs);

  const total = slots.reduce((sum, slot) => sum + rules.couponPrice[slot.meal], 0);
  const weekStart = time.upcomingWeekStart(time.dateKeyOf(nowMs));
  const transaction = await createTransaction(
    {
      userId: user._id,
      kind: 'coupons',
      mess: 'FF',
      description: `Weekly coupons x${slots.length}, week of ${time.formatDay(weekStart)}`,
      amount: total,
      method: body.payment.method,
      paymentRef: paymentRefOf(body.payment),
      items: slots.map((slot) => ({ label: slotLabel(slot), date: slot.date, meal: slot.meal, amount: rules.couponPrice[slot.meal] })),
    },
    nowMs,
  );
  const coupons = slots.map((slot) => ({
    _id: new ObjectId(),
    userId: user._id,
    date: slot.date,
    meal: slot.meal,
    price: rules.couponPrice[slot.meal],
    status: 'active',
    txnId: transaction._id,
    createdAt: transaction.at,
    usedAt: null,
  }));

  try {
    await col('coupons').insertMany(coupons, { ordered: false });
  } catch (error) {
    await col('coupons').deleteMany({ txnId: transaction._id });
    await removeTransaction(transaction._id);
    if (isDuplicateKey(error)) throw problem('DUPLICATE', 'One of these coupons was just taken. Refresh and try again.');
    throw error;
  }
  res.status(201).json({ transaction: toTransaction(transaction), coupons: coupons.map(toCoupon) });
});

router.post('/bookings', member, async (req, res) => {
  const body = parse(bookingSchema, req.body);
  const slots = uniqueSlots(body.slots);
  const user = req.user;
  const nowMs = req.nowMs;
  await assertBooking(user, slots, nowMs);

  const total = slots.reduce((sum, slot) => sum + rules.booking[slot.meal].price, 0);
  const transaction = await createTransaction(
    {
      userId: user._id,
      kind: 'booking',
      mess: 'FF',
      description: `Advance booking x${slots.length}`,
      amount: total,
      method: body.payment.method,
      paymentRef: paymentRefOf(body.payment),
      items: slots.map((slot) => ({ label: slotLabel(slot), date: slot.date, meal: slot.meal, amount: rules.booking[slot.meal].price })),
    },
    nowMs,
  );
  const bookings = slots.map((slot) => ({
    _id: new ObjectId(),
    userId: user._id,
    date: slot.date,
    meal: slot.meal,
    price: rules.booking[slot.meal].price,
    status: 'booked',
    active: true,
    txnId: transaction._id,
    createdAt: transaction.at,
    usedAt: null,
    cancelledAt: null,
  }));

  try {
    await col('bookings').insertMany(bookings, { ordered: false });
  } catch (error) {
    await col('bookings').deleteMany({ txnId: transaction._id });
    await removeTransaction(transaction._id);
    if (isDuplicateKey(error)) throw problem('ALREADY_BOOKED', 'One of these meals was just booked. Refresh and try again.');
    throw error;
  }
  res.status(201).json({ transaction: toTransaction(transaction), bookings: bookings.map(toBooking) });
});

router.delete('/bookings/:id', member, async (req, res) => {
  const { id } = req.params;
  if (!/^[0-9a-f]{24}$/i.test(id)) throw problem('NOT_FOUND', 'Booking not found.');
  const user = req.user;
  const nowMs = req.nowMs;

  const booking = await col('bookings').findOne({ _id: new ObjectId(id), userId: user._id });
  if (!booking) throw problem('NOT_FOUND', 'Booking not found.');
  const label = slotLabel(booking);
  if (booking.status !== 'booked') throw problem('NOT_CANCELLABLE', `${label} can no longer be cancelled.`);
  if (!time.bookingOpen(booking.date, booking.meal, nowMs)) {
    throw problem('CUTOFF_PASSED', `${label} can no longer be cancelled.`);
  }

  const cancelled = await col('bookings').findOneAndUpdate(
    { _id: booking._id, userId: user._id, status: 'booked' },
    { $set: { status: 'cancelled', active: false, cancelledAt: new Date(nowMs).toISOString() } },
    { returnDocument: 'after' },
  );
  if (!cancelled) throw problem('NOT_CANCELLABLE', `${label} can no longer be cancelled.`);

  const original = await col('transactions').findOne({ _id: booking.txnId }, { projection: { method: 1, paymentRef: 1 } });
  const refund = await createTransaction(
    {
      userId: user._id,
      kind: 'booking',
      mess: 'FF',
      description: `Refund, ${label}`,
      amount: -booking.price,
      method: original?.method ?? null,
      paymentRef: original?.paymentRef ?? null,
      items: [{ label, date: booking.date, meal: booking.meal, amount: -booking.price }],
      refundOf: booking.txnId,
    },
    nowMs,
  );
  res.json({ booking: toBooking(cancelled), transaction: toTransaction(refund) });
});

module.exports = router;
