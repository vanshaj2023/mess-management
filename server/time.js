const { env, rules, MEALS } = require('./config');

const IST_OFFSET_MS = 330 * 60 * 1000;
const MS_PER_DAY = 86400000;
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (value) => String(value).padStart(2, '0');
const keyFromUtc = (date) => `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
const utcOfKey = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

function isValidKey(key) {
  const match = KEY_PATTERN.exec(key);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const dateKeyOf = (epochMs) => keyFromUtc(new Date(epochMs + IST_OFFSET_MS));

function minutesOfDay(epochMs) {
  const shifted = new Date(epochMs + IST_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

function addDaysKey(key, days) {
  const date = utcOfKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return keyFromUtc(date);
}

const dayOfWeek = (key) => utcOfKey(key).getUTCDay();
const mondayOf = (key) => addDaysKey(key, -((dayOfWeek(key) + 6) % 7));
const upcomingWeekStart = (todayKey) => (dayOfWeek(todayKey) === 1 ? todayKey : addDaysKey(mondayOf(todayKey), 7));
const weekDateKeys = (startKey) => Array.from({ length: 7 }, (_, offset) => addDaysKey(startKey, offset));
const instantAt = (key, minutes) => utcOfKey(key).getTime() + minutes * 60000 - IST_OFFSET_MS;

function formatDay(key) {
  const [, month, day] = key.split('-').map(Number);
  return `${DAY_SHORT[dayOfWeek(key)]} ${day} ${MONTH_SHORT[month - 1]}`;
}

const formatClock = (minutes) => `${Math.floor(minutes / 60) % 12 || 12}:${pad2(minutes % 60)} ${minutes >= 720 ? 'PM' : 'AM'}`;

function semesterOf(epochMs) {
  const shifted = new Date(epochMs + IST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const isAutumn = shifted.getUTCMonth() >= 6;
  return {
    id: `${year}-${isAutumn ? 'AUT' : 'SPR'}`,
    label: `${isAutumn ? 'Autumn' : 'Spring'} ${year}`,
    startKey: `${year}-${isAutumn ? '07-01' : '01-01'}`,
    endKey: `${year}-${isAutumn ? '12-31' : '06-30'}`,
  };
}

const mealEndMs = (key, meal) => instantAt(key, rules.mealWindow[meal].end);
const bookingCutoffMs = (key, meal) => instantAt(key, rules.booking[meal].cutoffHour * 60);
const bookingOpen = (key, meal, nowMs) => Boolean(rules.booking[meal]) && nowMs < bookingCutoffMs(key, meal);

function currentMeal(nowMs) {
  const minutes = minutesOfDay(nowMs);
  return MEALS.find((meal) => minutes >= rules.mealWindow[meal].start && minutes < rules.mealWindow[meal].end) ?? null;
}

function upcomingMeal(nowMs) {
  const minutes = minutesOfDay(nowMs);
  return MEALS.find((meal) => minutes < rules.mealWindow[meal].start) ?? null;
}

function resolveNow(headerValue) {
  const real = Date.now();
  if (!env.allowDemoClock || typeof headerValue !== 'string' || !/^\d{10,15}$/.test(headerValue)) return real;
  const requested = Number(headerValue);
  return Math.abs(requested - real) <= 400 * MS_PER_DAY ? requested : real;
}

function attachNow(req, res, next) {
  req.nowMs = resolveNow(req.get('x-demo-now'));
  next();
}

module.exports = {
  MS_PER_DAY,
  isValidKey,
  dateKeyOf,
  minutesOfDay,
  addDaysKey,
  dayOfWeek,
  mondayOf,
  upcomingWeekStart,
  weekDateKeys,
  instantAt,
  formatDay,
  formatClock,
  semesterOf,
  mealEndMs,
  bookingCutoffMs,
  bookingOpen,
  currentMeal,
  upcomingMeal,
  attachNow,
};
