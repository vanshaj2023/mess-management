const { ObjectId } = require('mongodb');
const { rules, MEAL_LABEL, MESSES } = require('./config');
const time = require('./time');
const { col } = require('./db');
const { problem, isDuplicateKey } = require('./errors');
const { toPublicUser } = require('./serializers');
const { orderNumber } = require('./orders');

const rupees = (amount) => `${amount < 0 ? '-' : ''}₹${Math.abs(amount).toLocaleString('en-IN')}`;
const isSemesterMess = (messId) => messId === 'GF' || messId === 'PB';
const assignmentLabel = (user) => (user.mess === 'NONE' ? 'No mess selected' : MESSES[user.mess].name);
const slotLabel = (slot) => `${MEAL_LABEL[slot.meal]} on ${time.formatDay(slot.date)}`;

function policyFor(user) {
  if (user.category === 'student' && user.year === 1) return { forced: 'PB', options: ['PB'] };
  if (user.category === 'student' && user.year === 2) return { forced: 'GF', options: ['GF'] };
  return { forced: null, options: ['GF', 'FF', 'NONE'] };
}

async function currentSubscription(userId, nowMs) {
  return col('subscriptions').findOne({ userId, semesterId: time.semesterOf(nowMs).id });
}

async function isSubscribed(user, nowMs) {
  if (!isSemesterMess(user.mess)) return false;
  return Boolean(await currentSubscription(user._id, nowMs));
}

async function mealPlanLock(user, nowMs) {
  if (await isSubscribed(user, nowMs)) {
    return `Your ${time.semesterOf(nowMs).label} subscription is paid and cannot be changed this semester.`;
  }
  const today = time.dateKeyOf(nowMs);
  const [holdsCoupons, holdsBookings] = await Promise.all([
    col('coupons').findOne({ userId: user._id, status: 'active', date: { $gte: today } }, { projection: { _id: 1 } }),
    col('bookings').findOne({ userId: user._id, status: 'booked', date: { $gte: today } }, { projection: { _id: 1 } }),
  ]);
  if (holdsCoupons || holdsBookings) return 'You still hold unused coupons or bookings. Use them before switching mess.';
  return '';
}

async function planContext(nowMs) {
  const today = time.dateKeyOf(nowMs);
  const [subscribedIds, couponCounts] = await Promise.all([
    col('subscriptions').distinct('userId', { semesterId: time.semesterOf(nowMs).id }),
    col('coupons')
      .aggregate([{ $match: { status: 'active', date: { $gte: today } } }, { $group: { _id: '$userId', count: { $sum: 1 } } }])
      .toArray(),
  ]);
  return { subscribed: new Set(subscribedIds), coupons: new Map(couponCounts.map((row) => [row._id, row.count])) };
}

function planStatus(user, context) {
  if (user.mess === 'NONE') return { label: 'No mess', tone: 'muted' };
  if (user.mess === 'FF') {
    const upcoming = context.coupons.get(user._id) ?? 0;
    return upcoming ? { label: `${upcoming} coupons`, tone: 'ok' } : { label: 'No coupons', tone: 'warn' };
  }
  if (!context.subscribed.has(user._id)) return { label: 'Fee due', tone: 'bad' };
  return user.fpEnrolled ? { label: 'Active', tone: 'ok' } : { label: 'Enrol fingerprint', tone: 'warn' };
}

async function createTransaction({ userId, kind, mess, description, amount, method, paymentRef, items, refundOf }, nowMs) {
  const at = new Date(nowMs).toISOString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const doc = {
      _id: new ObjectId(),
      orderNo: orderNumber(at),
      userId,
      kind,
      mess,
      description,
      amount,
      status: amount < 0 ? 'refund' : 'paid',
      method: method ?? null,
      paymentRef: paymentRef ?? null,
      items: items ?? [],
      refundOf: refundOf ?? null,
      at,
    };
    try {
      await col('transactions').insertOne(doc);
      return doc;
    } catch (error) {
      if (!isDuplicateKey(error) || !error.keyPattern?.orderNo) throw error;
    }
  }
  throw new Error('Could not allocate an order number');
}

async function removeTransaction(transactionId) {
  await col('transactions').deleteOne({ _id: transactionId });
}

async function assertCouponPurchase(user, slots, nowMs) {
  if (user.mess !== 'FF') throw problem('NOT_FF', 'Switch to First Floor Mess to buy coupons.');
  if (slots.length === 0) throw problem('NO_SLOTS', 'Pick at least one meal.');

  const weekKeys = time.weekDateKeys(time.upcomingWeekStart(time.dateKeyOf(nowMs)));
  if (slots.some((slot) => !weekKeys.includes(slot.date))) {
    throw problem('OUTSIDE_SALE_WEEK', 'Coupons are sold for the upcoming week only.');
  }

  const owned = await col('coupons').find({ userId: user._id, date: { $in: weekKeys } }).toArray();
  const duplicate = slots.find((slot) => owned.some((coupon) => coupon.date === slot.date && coupon.meal === slot.meal));
  if (duplicate) throw problem('DUPLICATE', `You already hold a coupon for ${slotLabel(duplicate)}.`);

  if (slots.some((slot) => time.mealEndMs(slot.date, slot.meal) <= nowMs)) {
    throw problem('MEAL_PASSED', 'One of the selected meals has already passed.');
  }

  const total = owned.reduce((sum, coupon) => sum + coupon.price, 0) + slots.reduce((sum, slot) => sum + rules.couponPrice[slot.meal], 0);
  if (total < rules.weeklyMinimum) {
    throw problem('BELOW_MINIMUM', `The weekly minimum is ${rupees(rules.weeklyMinimum)}. You are ${rupees(rules.weeklyMinimum - total)} short.`);
  }
}

async function assertBooking(user, slots, nowMs) {
  if (user.mess !== 'FF') throw problem('NOT_FF', 'Switch to First Floor Mess to book meals.');
  if (slots.length === 0) throw problem('NO_SLOTS', 'Pick at least one meal.');

  const today = time.dateKeyOf(nowMs);
  const lastBookable = time.addDaysKey(today, 13);
  const dates = [...new Set(slots.map((slot) => slot.date))];
  const [coupons, bookings] = await Promise.all([
    col('coupons').find({ userId: user._id, date: { $in: dates } }).toArray(),
    col('bookings').find({ userId: user._id, date: { $in: dates }, active: true }).toArray(),
  ]);

  for (const slot of slots) {
    const label = slotLabel(slot);
    const rule = rules.booking[slot.meal];
    if (!rule) throw problem('NOT_BOOKABLE', `${MEAL_LABEL[slot.meal]} cannot be booked in advance.`);
    if (slot.date < today) throw problem('PAST_DATE', `${label} is in the past.`);
    if (slot.date > lastBookable) throw problem('NOT_BOOKABLE', 'Bookings open for the next 14 days only.');
    if (!time.bookingOpen(slot.date, slot.meal, nowMs)) {
      throw problem('CUTOFF_PASSED', `Booking for ${label} closed at ${time.formatClock(rule.cutoffHour * 60)}.`);
    }
    if (coupons.some((coupon) => coupon.date === slot.date && coupon.meal === slot.meal)) {
      throw problem('COUPON_EXISTS', `${label} is already covered by a coupon.`);
    }
    if (bookings.some((booking) => booking.date === slot.date && booking.meal === slot.meal)) {
      throw problem('ALREADY_BOOKED', `${label} is already booked.`);
    }
  }
}

async function insertScan(entry, nowMs) {
  const doc = {
    _id: new ObjectId(),
    userId: null,
    meal: null,
    reason: '',
    via: 'fingerprint',
    ...entry,
    date: time.dateKeyOf(nowMs),
    at: new Date(nowMs).toISOString(),
  };
  await col('scans').insertOne(doc);
  return doc;
}

function scanOutcome(ok, title, detail, user, meal) {
  return { ok, title, detail, user: toPublicUser(user), meal };
}

function nextMealDetail(nowMs) {
  const next = time.upcomingMeal(nowMs);
  return next ? `${MEAL_LABEL[next]} starts at ${time.formatClock(rules.mealWindow[next].start)}.` : 'Service is over for today.';
}

async function verifyEntry(messId, fingerId, nowMs) {
  const meal = time.currentMeal(nowMs);
  const deny = async (title, detail, user = null) => {
    await insertScan({ userId: user?._id ?? null, mess: messId, meal, result: 'denied', reason: title }, nowMs);
    return scanOutcome(false, title, detail, user, meal);
  };

  const id = fingerId.trim().toUpperCase();
  const user = id ? await col('users').findOne({ _id: id, role: 'member' }) : null;
  if (!user || !user.fpEnrolled) {
    return deny('Fingerprint not recognised', 'No enrolled print matches. Students enrol after paying the semester fee.');
  }
  if (user.mess !== messId) return deny('Wrong mess', `${user.name} is registered with ${assignmentLabel(user)}.`, user);
  if (!(await isSubscribed(user, nowMs))) {
    return deny('Subscription unpaid', `The ${time.semesterOf(nowMs).label} fee is pending.`, user);
  }
  if (!meal) return deny('No meal service now', nextMealDetail(nowMs), user);

  try {
    await insertScan({ userId: user._id, mess: messId, meal, result: 'served' }, nowMs);
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    return deny('Already served', `${user.name} has already had ${MEAL_LABEL[meal]} today.`, user);
  }
  return scanOutcome(true, 'Verified', `${MEAL_LABEL[meal]} for ${user.name}`, user, meal);
}

async function redeemAtCounter(rawId, nowMs) {
  const today = time.dateKeyOf(nowMs);
  const meal = time.currentMeal(nowMs);
  const deny = async (title, detail, user = null) => {
    await insertScan({ userId: user?._id ?? null, mess: 'FF', meal, result: 'denied', reason: title, via: 'counter' }, nowMs);
    return scanOutcome(false, title, detail, user, meal);
  };

  const user = await col('users').findOne({ _id: rawId.trim().toUpperCase(), role: 'member' });
  if (!user) return deny('Unknown ID', 'No member found with that roll number or employee ID.');
  if (user.mess !== 'FF') return deny('Not a First Floor member', `${user.name} is registered with ${assignmentLabel(user)}.`, user);
  if (!meal) return deny('No meal service now', nextMealDetail(nowMs), user);

  const [coupon, booking] = await Promise.all([
    col('coupons').findOne({ userId: user._id, date: today, meal }),
    col('bookings').findOne({ userId: user._id, date: today, meal, active: true }),
  ]);
  const alreadyRedeemed = () => deny('Already redeemed', `${user.name} has already used ${MEAL_LABEL[meal]} today.`, user);

  const useCoupon = coupon?.status === 'active';
  const useBooking = !useCoupon && booking?.status === 'booked';
  if (!useCoupon && !useBooking) {
    if (coupon || booking) return alreadyRedeemed();
    return deny('No coupon or booking', `${user.name} has neither for ${MEAL_LABEL[meal]} today.`, user);
  }

  const via = useCoupon ? 'coupon' : 'booking';
  let scan = null;
  try {
    scan = await insertScan({ userId: user._id, mess: 'FF', meal, result: 'served', via }, nowMs);
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    return alreadyRedeemed();
  }

  const target = useCoupon ? coupon : booking;
  const claimed = await col(useCoupon ? 'coupons' : 'bookings').findOneAndUpdate(
    { _id: target._id, status: useCoupon ? 'active' : 'booked' },
    { $set: { status: 'used', usedAt: new Date(nowMs).toISOString() } },
  );
  if (!claimed) {
    await col('scans').deleteOne({ _id: scan._id });
    return alreadyRedeemed();
  }
  return scanOutcome(true, useCoupon ? 'Coupon accepted' : 'Booking accepted', `${MEAL_LABEL[meal]} for ${user.name}`, user, meal);
}

module.exports = {
  rupees,
  isSemesterMess,
  assignmentLabel,
  slotLabel,
  policyFor,
  currentSubscription,
  isSubscribed,
  mealPlanLock,
  planContext,
  planStatus,
  createTransaction,
  removeTransaction,
  assertCouponPurchase,
  assertBooking,
  verifyEntry,
  redeemAtCounter,
};
