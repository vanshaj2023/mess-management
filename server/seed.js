const { ObjectId } = require('mongodb');
const { env, rules, MEALS, MEAL_LABEL, MESSES } = require('./config');
const time = require('./time');
const { col, wipeAll } = require('./db');
const { hashPassword } = require('./auth');
const { orderNumber } = require('./orders');

const ROSTER = [
  { id: 'B526001', name: 'Aarav Mishra', year: 1, mess: 'PB', plan: 'subscribed' },
  { id: 'B526002', name: 'Sneha Patra', year: 1, mess: 'PB', plan: 'due' },
  { id: 'B526003', name: 'Debasis Rout', year: 1, mess: 'PB', plan: 'subscribed' },
  { id: 'B526004', name: 'Lipsa Jena', year: 1, mess: 'PB', plan: 'paid-no-fingerprint' },
  { id: 'B525011', name: 'Rohan Das', year: 2, mess: 'GF', plan: 'subscribed' },
  { id: 'B525012', name: 'Smruti Panda', year: 2, mess: 'GF', plan: 'subscribed' },
  { id: 'B525013', name: 'Abhijit Sethy', year: 2, mess: 'GF', plan: 'due' },
  { id: 'B524021', name: 'Ananya Sahoo', year: 3, mess: 'FF', plan: 'full' },
  { id: 'B524022', name: 'Manas Dash', year: 3, mess: 'GF', plan: 'subscribed' },
  { id: 'B524023', name: 'Itishree Swain', year: 3, mess: 'FF', plan: 'lunch-dinner' },
  { id: 'B523031', name: 'Kiran Behera', year: 4, mess: 'GF', plan: 'subscribed' },
  { id: 'B523032', name: 'Priya Nayak', year: 4, mess: 'NONE', plan: 'none' },
  { id: 'B523033', name: 'Sourav Biswal', year: 4, mess: 'FF', plan: 'booking-only' },
  { id: 'E1042', name: 'Dr. S. Mohanty', year: null, mess: 'FF', plan: 'lunch-dinner' },
  { id: 'E1077', name: 'R. K. Pradhan', year: null, mess: 'GF', plan: 'subscribed' },
];

const COUPON_PATTERNS = {
  full: () => true,
  'lunch-dinner': (meal) => meal !== 'breakfast',
};

const MENUS = {
  GF: [
    ['Idli, sambar, coconut chutney', 'Rice, dal tadka, aloo gobi, salad, curd', 'Roti, paneer butter masala, jeera rice, dal fry'],
    ['Poori, aloo sabji', 'Rice, sambar, cabbage poriyal, papad, buttermilk', 'Roti, egg curry or mix veg, rice, dal'],
    ['Chuda, ghuguni, banana', 'Rice, dalma, baigan bharta, salad', 'Roti, chicken curry or soya curry, rice'],
    ['Aloo paratha, curd, pickle', 'Rice, rajma, bhindi fry, raita', 'Veg fried rice, manchurian, tomato soup'],
    ['Upma, chutney, boiled egg', 'Rice, dal, fish curry or kadai paneer, salad', 'Roti, mix veg, rice, dal tadka, kheer'],
    ['Masala dosa, sambar', 'Veg pulao, boondi raita, dal, aloo fry', 'Roti, chole, rice, dal, jalebi'],
    ['Dahibara aloodum', 'Chicken or veg biryani, raita, salad', 'Roti, paneer tikka masala, rice, dal, gulab jamun'],
  ],
  PB: [
    ['Poha, sev, tea', 'Rice, dalma, mixed veg, papad, curd', 'Roti, egg bhurji or paneer bhurji, rice, dal'],
    ['Idli, vada, sambar', 'Rice, kadhi, aloo jeera, salad', 'Roti, chicken curry or mushroom masala, rice, dal'],
    ['Bread, jam, boiled egg', 'Rice, chole, bhindi masala, raita', 'Roti, dal makhani, rice, mix veg, ice cream'],
    ['Chuda, dahi, banana', 'Rice, sambar, beans poriyal, fryums', 'Hakka noodles, veg manchurian, soup'],
    ['Poori, chole', 'Rice, dal, fish curry or paneer curry, salad', 'Roti, aloo matar, rice, dal, sooji halwa'],
    ['Paratha, curd, pickle', 'Veg biryani, raita, mix veg', 'Roti, egg curry or kofta, rice, dal, rasgulla'],
    ['Pakhala, badi chura, saga bhaja', 'Rice, mutton or paneer curry, dal, salad', 'Roti, veg kolhapuri, pulao, dal, kulfi'],
  ],
  FF: [
    ['Poori, aloo sabji', 'Rice, dal, seasonal veg, salad', 'Roti, veg curry, rice, dal'],
    ['Idli, sambar', 'Rice, rajma, aloo fry, curd', 'Roti, egg curry or paneer curry, rice'],
    ['Upma, chutney', 'Rice, dalma, cabbage fry, papad', 'Roti, chicken curry or soya curry, rice'],
    ['Aloo paratha, curd', 'Rice, sambar, beans fry, buttermilk', 'Fried rice, gobi manchurian'],
    ['Bread omelette or sandwich', 'Rice, dal, fish curry or paneer curry', 'Roti, mix veg, rice, dal, sweet'],
    ['Dosa, sambar, chutney', 'Veg pulao, raita, dal', 'Roti, chole, rice, dal'],
    ['Chuda, ghuguni', 'Biryani (chicken or veg), raita, salad', 'Roti, paneer butter masala, rice, dal, gulab jamun'],
  ],
};

const iso = (epochMs) => new Date(epochMs).toISOString();

async function insertAll(name, docs) {
  if (docs.length > 0) await col(name).insertMany(docs);
}

async function seedDatabase(nowMs = Date.now()) {
  const todayKey = time.dateKeyOf(nowMs);
  const semester = time.semesterOf(nowMs);
  const semesterStartMs = time.instantAt(semester.startKey, 0);
  const [memberHash, adminHash] = await Promise.all([hashPassword('demo123'), hashPassword('admin123')]);

  const docs = { users: [], subscriptions: [], coupons: [], bookings: [], scans: [], transactions: [] };

  const usedOrderNumbers = new Set();
  const addTransaction = ({ method = 'upi', ...fields }) => {
    let orderNo = orderNumber(fields.at);
    while (usedOrderNumbers.has(orderNo)) orderNo = orderNumber(fields.at);
    usedOrderNumbers.add(orderNo);
    const doc = {
      _id: new ObjectId(),
      orderNo,
      status: fields.amount < 0 ? 'refund' : 'paid',
      method,
      paymentRef: method === 'card' ? 'Card ending 4242' : `${fields.userId.toLowerCase()}@oksbi`,
      items: [],
      refundOf: null,
      ...fields,
    };
    docs.transactions.push(doc);
    return doc;
  };
  const slotLabel = (date, meal) => `${MEAL_LABEL[meal]} on ${time.formatDay(date)}`;

  const servedScan = ({ userId, mess, date, meal, minutes, via = 'fingerprint' }) => ({
    _id: new ObjectId(),
    userId,
    mess,
    date,
    meal,
    result: 'served',
    reason: '',
    via,
    at: iso(time.instantAt(date, minutes)),
  });

  docs.users.push({
    _id: 'ADMIN',
    name: 'Mess Office',
    role: 'admin',
    category: 'staff',
    year: null,
    email: 'messoffice@iiit-bh.ac.in',
    phone: '9437000000',
    passwordHash: adminHash,
    mess: 'NONE',
    fpEnrolled: false,
    createdAt: iso(semesterStartMs),
    updatedAt: iso(semesterStartMs),
    lastLoginAt: iso(nowMs),
    loginCount: 1,
  });

  ROSTER.forEach((person, index) => {
    const isStaff = person.year === null;
    const method = index % 3 === 0 ? 'card' : 'upi';
    docs.users.push({
      _id: person.id,
      name: person.name,
      role: 'member',
      category: isStaff ? 'staff' : 'student',
      year: person.year,
      email: `${person.id.toLowerCase()}@iiit-bh.ac.in`,
      phone: `9437${String(100000 + index * 7919)}`,
      passwordHash: memberHash,
      mess: person.mess,
      fpEnrolled: person.plan === 'subscribed',
      fpEnrolledAt: person.plan === 'subscribed' ? iso(Math.min(nowMs, semesterStartMs + (4 + index) * time.MS_PER_DAY)) : null,
      createdAt: iso(semesterStartMs),
      updatedAt: iso(semesterStartMs),
      lastLoginAt: iso(nowMs - (index + 1) * 5400000),
      loginCount: 3 + index,
    });

    if (person.plan === 'subscribed' || person.plan === 'paid-no-fingerprint') {
      const paidAt = iso(Math.min(nowMs, semesterStartMs + (3 + index) * time.MS_PER_DAY));
      const transaction = addTransaction({
        userId: person.id,
        kind: 'semester',
        mess: person.mess,
        description: `${MESSES[person.mess].name}, ${semester.label}`,
        amount: rules.semesterFee,
        method,
        items: [{ label: `${semester.label} semester plan`, amount: rules.semesterFee }],
        at: paidAt,
      });
      docs.subscriptions.push({
        _id: new ObjectId(),
        userId: person.id,
        mess: person.mess,
        semesterId: semester.id,
        amount: rules.semesterFee,
        txnId: transaction._id,
        paidAt,
      });
    }

    if (person.plan === 'subscribed') {
      for (let back = 1; back <= 5; back += 1) {
        const date = time.addDaysKey(todayKey, -back);
        MEALS.forEach((meal, mealIndex) => {
          if ((index + back + mealIndex) % 4 === 0) return;
          const minutes = rules.mealWindow[meal].start + 10 + ((index * 7 + back * 3) % 50);
          docs.scans.push(servedScan({ userId: person.id, mess: person.mess, date, meal, minutes }));
        });
      }
    }

    const pattern = COUPON_PATTERNS[person.plan];
    if (person.mess === 'FF' && pattern) {
      const weekStarts = new Set([time.mondayOf(todayKey), time.upcomingWeekStart(todayKey)]);
      weekStarts.forEach((startKey) => {
        const keys = time.weekDateKeys(startKey);
        const meals = MEALS.filter(pattern);
        const total = keys.length * meals.reduce((sum, meal) => sum + rules.couponPrice[meal], 0);
        const boughtAtKey = startKey === todayKey ? todayKey : time.addDaysKey(startKey, -2);
        const transaction = addTransaction({
          userId: person.id,
          kind: 'coupons',
          mess: 'FF',
          description: `Weekly coupons x${keys.length * meals.length}, week of ${time.formatDay(startKey)}`,
          amount: total,
          method,
          items: keys.flatMap((date) => meals.map((meal) => ({ label: slotLabel(date, meal), date, meal, amount: rules.couponPrice[meal] }))),
          at: iso(Math.min(time.instantAt(boughtAtKey, 0), nowMs)),
        });
        keys.forEach((date) => {
          meals.forEach((meal) => {
            const used = date < todayKey;
            docs.coupons.push({
              _id: new ObjectId(),
              userId: person.id,
              date,
              meal,
              price: rules.couponPrice[meal],
              status: used ? 'used' : 'active',
              txnId: transaction._id,
              createdAt: transaction.at,
              usedAt: used ? iso(time.instantAt(date, rules.mealWindow[meal].start + 25)) : null,
            });
            if (used) {
              docs.scans.push(servedScan({ userId: person.id, mess: 'FF', date, meal, minutes: rules.mealWindow[meal].start + 25, via: 'coupon' }));
            }
          });
        });
      });
    }

    if (person.plan === 'booking-only') {
      const date = time.addDaysKey(todayKey, 1);
      const bookedMeals = ['lunch', 'dinner'];
      const total = bookedMeals.reduce((sum, meal) => sum + rules.booking[meal].price, 0);
      const transaction = addTransaction({
        userId: person.id,
        kind: 'booking',
        mess: 'FF',
        description: `Advance booking x${bookedMeals.length}`,
        amount: total,
        method,
        items: bookedMeals.map((meal) => ({ label: slotLabel(date, meal), date, meal, amount: rules.booking[meal].price })),
        at: iso(nowMs),
      });
      bookedMeals.forEach((meal) => {
        const cancelled = meal === 'dinner';
        docs.bookings.push({
          _id: new ObjectId(),
          userId: person.id,
          date,
          meal,
          price: rules.booking[meal].price,
          status: cancelled ? 'cancelled' : 'booked',
          active: !cancelled,
          txnId: transaction._id,
          createdAt: transaction.at,
          usedAt: null,
          cancelledAt: cancelled ? iso(nowMs) : null,
        });
      });
      addTransaction({
        userId: person.id,
        kind: 'booking',
        mess: 'FF',
        description: `Refund, ${slotLabel(date, 'dinner')}`,
        amount: -rules.booking.dinner.price,
        method,
        items: [{ label: slotLabel(date, 'dinner'), date, meal: 'dinner', amount: -rules.booking.dinner.price }],
        refundOf: transaction._id,
        at: iso(nowMs),
      });
    }
  });

  const menus = [];
  Object.entries(MENUS).forEach(([mess, days]) => {
    days.forEach((dishes, day) => {
      dishes.forEach((dish, mealIndex) => menus.push({ mess, day, meal: MEALS[mealIndex], dishes: dish }));
    });
  });

  await insertAll('users', docs.users);
  await insertAll('transactions', docs.transactions);
  await insertAll('subscriptions', docs.subscriptions);
  await insertAll('coupons', docs.coupons);
  await insertAll('bookings', docs.bookings);
  await insertAll('scans', docs.scans);
  await insertAll('menus', menus);
}

async function seedIfEmpty() {
  const existing = await col('users').countDocuments({}, { limit: 1 });
  if (existing > 0) return false;
  await seedDatabase();
  return true;
}

async function ensureAdmin() {
  if (!env.adminPassword) return false;
  if (await col('users').findOne({ role: 'admin' }, { projection: { _id: 1 } })) return false;
  if (env.adminPassword.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  const now = new Date().toISOString();
  await col('users').insertOne({
    _id: 'ADMIN',
    name: 'Mess Office',
    role: 'admin',
    category: 'staff',
    year: null,
    email: 'messoffice@iiit-bh.ac.in',
    phone: '9437000000',
    passwordHash: await hashPassword(env.adminPassword),
    mess: 'NONE',
    fpEnrolled: false,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    loginCount: 0,
  });
  return true;
}

async function resetDemoData(nowMs = Date.now()) {
  await wipeAll();
  await seedDatabase(nowMs);
}

module.exports = { seedDatabase, seedIfEmpty, ensureAdmin, resetDemoData };
