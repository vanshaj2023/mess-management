const fs = require('node:fs');
const path = require('node:path');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isProduction = process.env.NODE_ENV === 'production';

const env = Object.freeze({
  port: toPositiveNumber(process.env.PORT, 4000),
  trustProxyHops: Math.floor(Number(process.env.TRUST_PROXY_HOPS ?? (isProduction ? 1 : 0))) || 0,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  mongoDb: process.env.MONGODB_DB || 'iiitbh_mess',
  sessionTtlDays: toPositiveNumber(process.env.SESSION_TTL_DAYS, 7),
  allowDemoClock: process.env.ALLOW_DEMO_CLOCK !== 'false',
  seedDemoData: process.env.SEED_DEMO_DATA !== 'false',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  isProduction,
});

const rules = Object.freeze({
  semesterFee: 17000,
  weeklyMinimum: 432,
  couponPrice: Object.freeze({ breakfast: 20, lunch: 55, dinner: 45 }),
  booking: Object.freeze({
    lunch: Object.freeze({ price: 60, cutoffHour: 9 }),
    dinner: Object.freeze({ price: 55, cutoffHour: 17 }),
  }),
  mealWindow: Object.freeze({
    breakfast: Object.freeze({ start: 450, end: 570 }),
    lunch: Object.freeze({ start: 750, end: 870 }),
    dinner: Object.freeze({ start: 1170, end: 1290 }),
  }),
});

const MEALS = Object.freeze(['breakfast', 'lunch', 'dinner']);
const MEAL_LABEL = Object.freeze({ breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' });

const MESSES = Object.freeze({
  GF: Object.freeze({ id: 'GF', name: 'Ground Floor Mess', short: 'Ground Floor' }),
  PB: Object.freeze({ id: 'PB', name: 'P Block Mess', short: 'P Block' }),
  FF: Object.freeze({ id: 'FF', name: 'First Floor Mess', short: 'First Floor' }),
});

module.exports = { env, rules, MEALS, MEAL_LABEL, MESSES };
