const { MongoClient } = require('mongodb');
const { env } = require('./config');

const COLLECTIONS = ['users', 'sessions', 'subscriptions', 'coupons', 'bookings', 'scans', 'transactions', 'menus'];

let client = null;
let database = null;

async function connect() {
  client = new MongoClient(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    await client.db(env.mongoDb).command({ ping: 1 });
  } catch (error) {
    await client.close().catch(() => undefined);
    client = null;
    throw new Error(`Cannot connect to MongoDB. Check MONGODB_URI in .env (${error.codeName ?? error.name}).`);
  }
  database = client.db(env.mongoDb);
  return database;
}

function col(name) {
  if (!database) throw new Error('Database is not connected');
  return database.collection(name);
}

async function ensureIndexes() {
  await Promise.all([
    col('users').createIndex({ email: 1 }, { unique: true }),
    col('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
    col('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    col('subscriptions').createIndex({ userId: 1, semesterId: 1 }, { unique: true }),
    col('coupons').createIndex({ userId: 1, date: 1, meal: 1 }, { unique: true }),
    col('coupons').createIndex({ date: 1, status: 1 }),
    col('bookings').createIndex({ userId: 1, date: 1, meal: 1 }, { unique: true, partialFilterExpression: { active: true } }),
    col('bookings').createIndex({ date: 1, active: 1 }),
    col('scans').createIndex({ userId: 1, mess: 1, date: 1, meal: 1 }, { unique: true, partialFilterExpression: { result: 'served' } }),
    col('scans').createIndex({ mess: 1, date: 1, at: -1 }),
    col('scans').createIndex({ userId: 1, at: -1 }),
    col('transactions').createIndex({ userId: 1, at: -1 }),
    col('transactions').createIndex({ at: -1 }),
    col('transactions').createIndex({ orderNo: 1 }, { unique: true, partialFilterExpression: { orderNo: { $type: 'string' } } }),
    col('menus').createIndex({ mess: 1, day: 1, meal: 1 }, { unique: true }),
  ]);
}

async function wipeAll() {
  await Promise.all(COLLECTIONS.map((name) => col(name).deleteMany({})));
}

async function dropDatabase() {
  await database.dropDatabase();
}

async function close() {
  if (client) await client.close();
  client = null;
  database = null;
}

module.exports = { connect, col, ensureIndexes, wipeAll, dropDatabase, close };
