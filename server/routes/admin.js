const express = require('express');
const { env, MEALS } = require('../config');
const time = require('../time');
const { col } = require('../db');
const { problem } = require('../errors');
const { requireRole, startSession } = require('../auth');
const { toPublicUser, toScan, toSubscription, toCoupon, toBooking, toTransaction, toMemberProfile, toContact } = require('../serializers');
const {
  parse,
  membersQuerySchema,
  ordersQuerySchema,
  slotsQuerySchema,
  memberIdSchema,
  kioskScanSchema,
  redeemSchema,
  recentQuerySchema,
  menuEditSchema,
} = require('../validation');
const { isSemesterMess, planContext, planStatus, verifyEntry, redeemAtCounter } = require('../rules');
const { resetDemoData } = require('../seed');

const router = express.Router();
router.use(requireRole('admin'));

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const searchStage = (needle, fields) => ({ $match: { $or: fields.map((field) => ({ [field]: { $regex: escapeRegex(needle), $options: 'i' } })) } });
const userLookup = [
  {
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      as: 'user',
      pipeline: [{ $project: { name: 1, category: 1, year: 1, email: 1, phone: 1, mess: 1 } }],
    },
  },
  { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
];

const isoStartOf = (dateKey) => new Date(time.instantAt(dateKey, 0)).toISOString();
const toSkip = (page, pageSize) => (page - 1) * pageSize;

function slotState(doc, nowMs) {
  if (doc.status === 'used' || doc.status === 'cancelled') return doc.status;
  return time.mealEndMs(doc.date, doc.meal) <= nowMs ? 'missed' : 'upcoming';
}

const REVENUE_LABELS = {
  semesterGF: 'Ground Floor semester plans',
  semesterPB: 'P Block semester plans',
  coupons: 'First Floor weekly coupons',
  bookings: 'First Floor advance bookings',
};

const emptyPlates = () => Object.fromEntries(MEALS.map((meal) => [meal, { served: 0, expected: 0 }]));

router.get('/overview', async (req, res) => {
  const nowMs = req.nowMs;
  const today = time.dateKeyOf(nowMs);
  const semesterId = time.semesterOf(nowMs).id;
  const upcomingKeys = Array.from({ length: 7 }, (_, offset) => time.addDaysKey(today, offset));
  const pastKeys = Array.from({ length: 7 }, (_, offset) => time.addDaysKey(today, offset - 6));

  const [
    members,
    subscribedIds,
    couponHolderIds,
    revenueRows,
    servedRows,
    couponTodayRows,
    bookingTodayRows,
    couponForecastRows,
    bookingForecastRows,
    footfallRows,
    ordersToday,
    upcomingBookings,
    upcomingCoupons,
    refundRows,
    recentRows,
  ] =
    await Promise.all([
      col('users').find({ role: 'member' }, { projection: { name: 1, category: 1, year: 1, mess: 1, fpEnrolled: 1 } }).toArray(),
      col('subscriptions').distinct('userId', { semesterId }),
      col('coupons').distinct('userId', { date: { $gte: today }, status: 'active' }),
      col('transactions').aggregate([{ $group: { _id: { kind: '$kind', mess: '$mess' }, amount: { $sum: '$amount' } } }]).toArray(),
      col('scans')
        .aggregate([{ $match: { date: today, result: 'served' } }, { $group: { _id: { mess: '$mess', meal: '$meal' }, count: { $sum: 1 } } }])
        .toArray(),
      col('coupons').aggregate([{ $match: { date: today } }, { $group: { _id: '$meal', count: { $sum: 1 } } }]).toArray(),
      col('bookings').aggregate([{ $match: { date: today, active: true } }, { $group: { _id: '$meal', count: { $sum: 1 } } }]).toArray(),
      col('coupons')
        .aggregate([{ $match: { date: { $in: upcomingKeys } } }, { $group: { _id: { date: '$date', meal: '$meal' }, count: { $sum: 1 } } }])
        .toArray(),
      col('bookings')
        .aggregate([{ $match: { date: { $in: upcomingKeys }, active: true } }, { $group: { _id: { date: '$date', meal: '$meal' }, count: { $sum: 1 } } }])
        .toArray(),
      col('scans')
        .aggregate([{ $match: { date: { $in: pastKeys }, result: 'served' } }, { $group: { _id: '$date', count: { $sum: 1 } } }])
        .toArray(),
      col('transactions').countDocuments({ amount: { $gt: 0 }, at: { $gte: isoStartOf(today), $lt: isoStartOf(time.addDaysKey(today, 1)) } }),
      col('bookings').countDocuments({ status: 'booked', date: { $gte: today } }),
      col('coupons').countDocuments({ status: 'active', date: { $gte: today } }),
      col('transactions').aggregate([{ $match: { amount: { $lt: 0 } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
      col('transactions').find({}).sort({ at: -1, _id: -1 }).limit(8).toArray(),
    ]);

  const recentUserIds = [...new Set(recentRows.map((row) => row.userId))];
  const recentUsers = recentUserIds.length ? await col('users').find({ _id: { $in: recentUserIds } }, { projection: { name: 1, category: 1, year: 1, email: 1, phone: 1, mess: 1 } }).toArray() : [];
  const recentContacts = new Map(recentUsers.map((member) => [member._id, toContact(member)]));

  const subscribed = new Set(subscribedIds);
  const dues = members.filter((member) => isSemesterMess(member.mess) && !subscribed.has(member._id));
  const subscribers = members.filter((member) => isSemesterMess(member.mess) && subscribed.has(member._id));

  const plates = { GF: emptyPlates(), PB: emptyPlates(), FF: emptyPlates() };
  for (const row of servedRows) {
    if (plates[row._id.mess] && plates[row._id.mess][row._id.meal]) plates[row._id.mess][row._id.meal].served = row.count;
  }
  for (const messId of ['GF', 'PB']) {
    const eating = subscribers.filter((member) => member.mess === messId && member.fpEnrolled).length;
    MEALS.forEach((meal) => {
      plates[messId][meal].expected = eating;
    });
  }
  for (const row of [...couponTodayRows, ...bookingTodayRows]) plates.FF[row._id].expected += row.count;

  const forecast = upcomingKeys.map((date) => {
    const entry = { date, breakfast: 0, lunch: 0, dinner: 0 };
    for (const row of [...couponForecastRows, ...bookingForecastRows]) {
      if (row._id.date === date) entry[row._id.meal] += row.count;
    }
    return entry;
  });

  const amountOf = (kind, mess) =>
    revenueRows.filter((row) => row._id.kind === kind && (mess === undefined || row._id.mess === mess)).reduce((sum, row) => sum + row.amount, 0);
  const revenue = [
    { key: 'semesterGF', amount: amountOf('semester', 'GF') },
    { key: 'semesterPB', amount: amountOf('semester', 'PB') },
    { key: 'coupons', amount: amountOf('coupons') },
    { key: 'bookings', amount: amountOf('booking') },
  ].map((row) => ({ ...row, label: REVENUE_LABELS[row.key] }));

  res.json({
    today,
    tiles: {
      members: members.length,
      staff: members.filter((member) => member.category === 'staff').length,
      subscribers: subscribers.length,
      duesCount: dues.length,
      couponHolders: couponHolderIds.length,
      netRevenue: revenueRows.reduce((sum, row) => sum + row.amount, 0),
      ordersToday,
      upcomingBookings,
      upcomingCoupons,
      refunded: Math.abs(refundRows[0]?.total ?? 0),
    },
    recentOrders: recentRows.map((row) => ({ ...toTransaction(row), user: recentContacts.get(row.userId) ?? null })),
    plates,
    forecast,
    revenue,
    dues: dues.map((member) => ({ id: member._id, name: member.name, category: member.category, year: member.year ?? null, mess: member.mess })),
    footfall: pastKeys.map((date) => ({ date, count: footfallRows.find((row) => row._id === date)?.count ?? 0 })),
  });
});

router.get('/members', async (req, res) => {
  const { q, mess, sort, dir } = parse(membersQuerySchema, req.query);
  const needle = q.trim().toLowerCase();
  const context = await planContext(req.nowMs);
  const users = await col('users').find({ role: 'member' }).toArray();

  const rows = users
    .filter((user) => mess === 'ALL' || user.mess === mess)
    .filter((user) => !needle || user.name.toLowerCase().includes(needle) || user._id.toLowerCase().includes(needle))
    .map((user) => ({
      id: user._id,
      name: user.name,
      category: user.category,
      year: user.year ?? null,
      mess: user.mess,
      email: user.email,
      phone: user.phone,
      fpEnrolled: Boolean(user.fpEnrolled),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
      plan: planStatus(user, context),
    }));

  const sorters = {
    id: (row) => row.id,
    name: (row) => row.name.toLowerCase(),
    type: (row) => (row.category === 'staff' ? 'Z' : String(row.year)),
    mess: (row) => row.mess,
    plan: (row) => row.plan.label,
  };
  const direction = dir === 'desc' ? -1 : 1;
  rows.sort((a, b) => String(sorters[sort](a)).localeCompare(String(sorters[sort](b)), 'en', { numeric: true }) * direction);
  res.json({ members: rows });
});

router.get('/members/:id', async (req, res) => {
  const { id } = parse(memberIdSchema, req.params);
  const user = await col('users').findOne({ _id: id.toUpperCase(), role: 'member' });
  if (!user) throw problem('NOT_FOUND', 'Member not found.');

  const nowMs = req.nowMs;
  const [context, subscriptions, coupons, bookings, scans, transactions, mealsEaten] = await Promise.all([
    planContext(nowMs),
    col('subscriptions').find({ userId: user._id }).sort({ paidAt: -1 }).toArray(),
    col('coupons').find({ userId: user._id }).sort({ date: -1 }).limit(400).toArray(),
    col('bookings').find({ userId: user._id }).sort({ date: -1 }).limit(400).toArray(),
    col('scans').find({ userId: user._id }).sort({ at: -1 }).limit(100).toArray(),
    col('transactions').find({ userId: user._id }).sort({ at: -1 }).limit(300).toArray(),
    col('scans').countDocuments({ userId: user._id, result: 'served' }),
  ]);

  const withState = (toRow) => (doc) => ({ ...toRow(doc), state: slotState(doc, nowMs) });
  const paid = transactions.filter((txn) => txn.amount > 0).reduce((sum, txn) => sum + txn.amount, 0);
  const refunded = transactions.filter((txn) => txn.amount < 0).reduce((sum, txn) => sum - txn.amount, 0);

  res.json({
    member: { ...toMemberProfile(user), plan: planStatus(user, context) },
    subscriptions: subscriptions.map(toSubscription),
    coupons: coupons.map(withState(toCoupon)),
    bookings: bookings.map(withState(toBooking)),
    scans: scans.map(toScan),
    transactions: transactions.map(toTransaction),
    stats: { mealsEaten, orders: transactions.filter((txn) => txn.amount > 0).length, paid, refunded, net: paid - refunded },
  });
});

router.get('/orders', async (req, res) => {
  const { q, kind, mess, method, type, from, to, page, pageSize } = parse(ordersQuerySchema, req.query);
  const match = {};
  if (kind !== 'ALL') match.kind = kind;
  if (mess !== 'ALL') match.mess = mess;
  if (method !== 'ALL') match.method = method;
  if (type === 'payment') match.amount = { $gt: 0 };
  if (type === 'refund') match.amount = { $lt: 0 };
  if (from || to) match.at = { ...(from && { $gte: isoStartOf(from) }), ...(to && { $lt: isoStartOf(time.addDaysKey(to, 1)) }) };
  const needle = q.trim();

  const [result] = await col('transactions')
    .aggregate([
      { $match: match },
      ...userLookup,
      ...(needle ? [searchStage(needle, ['orderNo', 'userId', 'user.name', 'user.email', 'description'])] : []),
      {
        $facet: {
          rows: [{ $sort: { at: -1, _id: -1 } }, { $skip: toSkip(page, pageSize) }, { $limit: pageSize }],
          totals: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                paid: { $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] } },
                refunded: { $sum: { $cond: [{ $lt: ['$amount', 0] }, { $multiply: ['$amount', -1] }, 0] } },
              },
            },
          ],
        },
      },
    ])
    .toArray();

  const totals = result.totals[0] ?? { count: 0, paid: 0, refunded: 0 };
  res.json({
    orders: result.rows.map((row) => ({ ...toTransaction(row), user: toContact(row.user) })),
    page,
    pageSize,
    total: totals.count,
    totals: { paid: totals.paid, refunded: totals.refunded, net: totals.paid - totals.refunded },
  });
});

router.get('/bookings', async (req, res) => {
  const { q, type, state, meal, from, to, page, pageSize } = parse(slotsQuerySchema, req.query);
  const nowMs = req.nowMs;
  const today = time.dateKeyOf(nowMs);
  const endedMeals = MEALS.filter((name) => time.mealEndMs(today, name) <= nowMs);
  const match = {};
  if (meal !== 'ALL') match.meal = meal;
  if (from || to) match.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  const needle = q.trim();

  const collectionOf = { coupon: 'coupons', booking: 'bookings' };
  const kinds = type === 'ALL' ? ['coupon', 'booking'] : [type];
  const tagged = (kindName) => [{ $match: match }, { $addFields: { type: kindName } }];

  const [result] = await col(collectionOf[kinds[0]])
    .aggregate([
      ...tagged(kinds[0]),
      ...kinds.slice(1).map((kindName) => ({ $unionWith: { coll: collectionOf[kindName], pipeline: tagged(kindName) } })),
      {
        $addFields: {
          mealOrder: { $indexOfArray: [MEALS, '$meal'] },
          state: {
            $switch: {
              branches: [
                { case: { $in: ['$status', ['used', 'cancelled']] }, then: '$status' },
                { case: { $lt: ['$date', today] }, then: 'missed' },
                { case: { $and: [{ $eq: ['$date', today] }, { $in: ['$meal', endedMeals] }] }, then: 'missed' },
              ],
              default: 'upcoming',
            },
          },
        },
      },
      ...(state === 'ALL' ? [] : [{ $match: { state } }]),
      ...userLookup,
      ...(needle ? [searchStage(needle, ['userId', 'user.name', 'user.email'])] : []),
      {
        $facet: {
          rows: [{ $sort: { date: -1, mealOrder: 1, 'user.name': 1 } }, { $skip: toSkip(page, pageSize) }, { $limit: pageSize }],
          counts: [{ $group: { _id: '$state', count: { $sum: 1 }, value: { $sum: '$price' } } }],
        },
      },
    ])
    .toArray();

  const orders = result.rows.length
    ? await col('transactions').find({ _id: { $in: result.rows.map((row) => row.txnId) } }, { projection: { orderNo: 1, method: 1, paymentRef: 1 } }).toArray()
    : [];
  const orderById = new Map(orders.map((order) => [String(order._id), order]));

  const summary = { upcoming: 0, used: 0, missed: 0, cancelled: 0 };
  let value = 0;
  for (const row of result.counts) {
    summary[row._id] = row.count;
    if (row._id !== 'cancelled') value += row.value;
  }

  res.json({
    slots: result.rows.map((row) => {
      const order = orderById.get(String(row.txnId));
      const base = row.type === 'coupon' ? toCoupon(row) : toBooking(row);
      return {
        ...base,
        type: row.type,
        state: row.state,
        user: toContact(row.user),
        orderNo: order?.orderNo ?? String(row.txnId).slice(-8).toUpperCase(),
        method: order?.method ?? null,
        paymentRef: order?.paymentRef ?? null,
      };
    }),
    page,
    pageSize,
    total: Object.values(summary).reduce((sum, count) => sum + count, 0),
    summary,
    value,
  });
});

router.get('/fingers', async (req, res) => {
  const users = await col('users').find({ role: 'member', fpEnrolled: true }).sort({ _id: 1 }).toArray();
  res.json({ fingers: users.map((user) => ({ id: user._id, name: user.name, mess: user.mess })) });
});

router.post('/kiosk/scan', async (req, res) => {
  const { mess, fingerId } = parse(kioskScanSchema, req.body);
  res.json({ result: await verifyEntry(mess, fingerId, req.nowMs) });
});

router.post('/kiosk/redeem', async (req, res) => {
  const { id } = parse(redeemSchema, req.body);
  res.json({ result: await redeemAtCounter(id, req.nowMs) });
});

router.get('/kiosk/recent', async (req, res) => {
  const { mess } = parse(recentQuerySchema, req.query);
  const today = time.dateKeyOf(req.nowMs);
  const scans = await col('scans').find({ mess, date: today }).sort({ at: -1 }).limit(8).toArray();
  const ids = [...new Set(scans.map((scan) => scan.userId).filter(Boolean))];
  const users = ids.length ? await col('users').find({ _id: { $in: ids } }, { projection: { name: 1 } }).toArray() : [];
  const names = new Map(users.map((user) => [user._id, user.name]));
  res.json({ scans: scans.map((scan) => ({ ...toScan(scan), userName: scan.userId ? (names.get(scan.userId) ?? null) : null })) });
});

router.put('/menu', async (req, res) => {
  const { mess, day, meal, dishes } = parse(menuEditSchema, req.body);
  await col('menus').updateOne({ mess, day, meal }, { $set: { dishes } }, { upsert: true });
  res.json({ ok: true });
});

router.post('/reset', async (req, res) => {
  if (!env.seedDemoData) throw problem('FORBIDDEN', 'Resetting is disabled because SEED_DEMO_DATA is false.');
  await resetDemoData(req.nowMs);
  await startSession(res, 'ADMIN');
  res.json({ ok: true });
});

module.exports = router;
