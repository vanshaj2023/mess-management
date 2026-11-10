const toUser = (doc) => ({
  id: doc._id,
  name: doc.name,
  role: doc.role,
  category: doc.category,
  year: doc.year ?? null,
  email: doc.email,
  phone: doc.phone,
  mess: doc.mess,
  fpEnrolled: Boolean(doc.fpEnrolled),
  createdAt: doc.createdAt,
});

const toPublicUser = (doc) =>
  doc ? { id: doc._id, name: doc.name, category: doc.category, year: doc.year ?? null, mess: doc.mess } : null;

const toSubscription = (doc) => ({
  id: String(doc._id),
  userId: doc.userId,
  mess: doc.mess,
  semesterId: doc.semesterId,
  amount: doc.amount,
  txnId: String(doc.txnId),
  paidAt: doc.paidAt,
});

const toCoupon = (doc) => ({
  id: String(doc._id),
  userId: doc.userId,
  date: doc.date,
  meal: doc.meal,
  price: doc.price,
  status: doc.status,
  txnId: String(doc.txnId),
  createdAt: doc.createdAt ?? null,
  usedAt: doc.usedAt ?? null,
});

const toBooking = (doc) => ({
  id: String(doc._id),
  userId: doc.userId,
  date: doc.date,
  meal: doc.meal,
  price: doc.price,
  status: doc.status,
  txnId: String(doc.txnId),
  createdAt: doc.createdAt ?? null,
  usedAt: doc.usedAt ?? null,
  cancelledAt: doc.cancelledAt ?? null,
});

const toScan = (doc) => ({
  id: String(doc._id),
  userId: doc.userId ?? null,
  mess: doc.mess,
  date: doc.date,
  meal: doc.meal ?? null,
  result: doc.result,
  reason: doc.reason ?? '',
  via: doc.via,
  at: doc.at,
});

const toTransaction = (doc) => ({
  id: String(doc._id),
  orderNo: doc.orderNo ?? String(doc._id).slice(-8).toUpperCase(),
  userId: doc.userId,
  kind: doc.kind,
  mess: doc.mess,
  description: doc.description,
  amount: doc.amount,
  status: doc.status ?? (doc.amount < 0 ? 'refund' : 'paid'),
  method: doc.method ?? null,
  paymentRef: doc.paymentRef ?? null,
  items: doc.items ?? [],
  refundOf: doc.refundOf ? String(doc.refundOf) : null,
  at: doc.at,
});

const toMemberProfile = (doc) => ({
  ...toUser(doc),
  fpEnrolledAt: doc.fpEnrolledAt ?? null,
  updatedAt: doc.updatedAt ?? doc.createdAt,
  lastLoginAt: doc.lastLoginAt ?? null,
  loginCount: doc.loginCount ?? 0,
});

const toContact = (doc) =>
  doc ? { id: doc._id, name: doc.name, category: doc.category, year: doc.year ?? null, email: doc.email, phone: doc.phone, mess: doc.mess } : null;

module.exports = { toUser, toPublicUser, toSubscription, toCoupon, toBooking, toScan, toTransaction, toMemberProfile, toContact };
