'use strict';

let CONFIG = {
  semesterFee: 17000,
  weeklyMinimum: 432,
  couponPrice: { breakfast: 20, lunch: 55, dinner: 45 },
  booking: {
    lunch: { price: 60, cutoffHour: 9 },
    dinner: { price: 55, cutoffHour: 17 },
  },
  mealWindow: {
    breakfast: { start: 450, end: 570 },
    lunch: { start: 750, end: 870 },
    dinner: { start: 1170, end: 1290 },
  },
  demoClock: true,
  scanHoldMs: 1100,
};

const MEALS = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const MEAL_ICON = {
  breakfast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 6v3M4.9 10.9l1.6 1.6M19.1 10.9l-1.6 1.6"/></svg>',
  lunch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dinner: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
};
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEAR_LABEL = { 1: '1st year', 2: '2nd year', 3: '3rd year', 4: '4th year' };
const MS_PER_DAY = 86400000;
const IST_OFFSET_MIN = 330;
const DEMO_KEY = 'iiitbh-demo-offset';
const AURORA = {
  GF: ['#6c63ff', '#3b82f6'],
  PB: ['#ff6584', '#a855f7'],
  FF: ['#38bdf8', '#6c63ff'],
  NONE: ['#6c63ff', '#ff6584'],
};

const rupees = (amount) => `${amount < 0 ? '-' : ''}₹${Math.abs(amount).toLocaleString('en-IN')}`;
let fullWeekValue = 0;
let MESSES = {};

function applyConfig(serverConfig) {
  CONFIG = { ...CONFIG, ...serverConfig };
  fullWeekValue = 7 * MEALS.reduce((sum, meal) => sum + CONFIG.couponPrice[meal], 0);
  const semesterSummary = `${rupees(CONFIG.semesterFee)} per semester, fingerprint entry, 3 meals a day, 7 days a week.`;
  MESSES = {
    GF: { id: 'GF', name: 'Ground Floor Mess', short: 'Ground Floor', model: 'Semester subscription', color: 'var(--gf)', summary: semesterSummary },
    PB: { id: 'PB', name: 'P Block Mess', short: 'P Block', model: 'Semester subscription', color: 'var(--pb)', summary: semesterSummary },
    FF: {
      id: 'FF',
      name: 'First Floor Mess',
      short: 'First Floor',
      model: 'Weekly coupons',
      color: 'var(--ff)',
      summary: `Breakfast ${rupees(CONFIG.couponPrice.breakfast)}, lunch ${rupees(CONFIG.couponPrice.lunch)}, dinner ${rupees(CONFIG.couponPrice.dinner)}. Minimum ${rupees(CONFIG.weeklyMinimum)} a week.`,
    },
  };
}
applyConfig({});

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

class SafeHtml {
  constructor(markup) {
    this.markup = markup;
  }
}

const raw = (markup) => new SafeHtml(markup);

const renderValue = (value) => {
  if (value instanceof SafeHtml) return value.markup;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  if (value === null || value === undefined || value === false) return '';
  return escapeHtml(value);
};

const html = (strings, ...values) =>
  new SafeHtml(strings.reduce((markup, chunk, index) => markup + renderValue(values[index - 1]) + chunk));

const mount = (element, safeHtml) => {
  element.innerHTML = safeHtml.markup;
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const pad2 = (value) => String(value).padStart(2, '0');
const dateKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const parseDateKey = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};
const mondayOf = (date) => addDays(startOfDay(date), -((date.getDay() + 6) % 7));
const minutesOfDay = (date) => date.getHours() * 60 + date.getMinutes();
const atMinutes = (key, minutes) => {
  const date = parseDateKey(key);
  date.setMinutes(minutes);
  return date;
};
const formatClock = (minutes) => `${Math.floor(minutes / 60) % 12 || 12}:${pad2(minutes % 60)} ${minutes >= 720 ? 'PM' : 'AM'}`;
const formatTime = (date) => formatClock(minutesOfDay(date));
const formatDay = (date) => `${DAY_SHORT[date.getDay()]} ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
const formatLong = (date) => `${DAY_LONG[date.getDay()]}, ${date.getDate()} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;
const formatCountdown = (ms) => {
  if (ms <= 0) return 'closed';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${pad2(totalSeconds % 60)}s`;
};
const toLocalInputValue = (date) => `${dateKey(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
const initialsOf = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
const greetingFor = (date) => (date.getHours() < 12 ? 'Good morning' : date.getHours() < 17 ? 'Good afternoon' : 'Good evening');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toWall = (epochMs) => new Date(epochMs + (IST_OFFSET_MIN + new Date(epochMs).getTimezoneOffset()) * 60000);
const fromWall = (wall) => wall.getTime() - (IST_OFFSET_MIN + wall.getTimezoneOffset()) * 60000;
const wallFromIso = (iso) => toWall(Date.parse(iso));
const formatStamp = (iso) => {
  const date = wallFromIso(iso);
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}, ${formatTime(date)}`;
};

function loadDemoOffset() {
  try {
    return Number(localStorage.getItem(DEMO_KEY)) || 0;
  } catch (error) {
    console.warn('localStorage is unavailable, demo clock will not persist.', error);
    return 0;
  }
}

function saveDemoOffset() {
  try {
    localStorage.setItem(DEMO_KEY, String(demo.offsetMs));
  } catch (error) {
    console.warn('Could not persist the demo clock.', error);
  }
}

const demo = { offsetMs: loadDemoOffset() };
const clock = {
  now: () => toWall(Date.now() + demo.offsetMs),
  isSimulated: () => demo.offsetMs !== 0,
};

function semesterOf(date) {
  const year = date.getFullYear();
  const isAutumn = date.getMonth() >= 6;
  return {
    id: `${year}-${isAutumn ? 'AUT' : 'SPR'}`,
    label: `${isAutumn ? 'Autumn' : 'Spring'} ${year}`,
    start: new Date(year, isAutumn ? 6 : 0, 1),
    end: new Date(year, isAutumn ? 11 : 5, isAutumn ? 31 : 30),
  };
}

function upcomingWeekStart(now) {
  const today = startOfDay(now);
  return today.getDay() === 1 ? today : addDays(mondayOf(today), 7);
}

const weekDateKeys = (startDate) => Array.from({ length: 7 }, (_, offset) => dateKey(addDays(startDate, offset)));
const slotKey = (date, meal) => `${date}|${meal}`;
const parseSlot = (key) => {
  const [date, meal] = key.split('|');
  return { date, meal };
};

const mealEnd = (key, meal) => atMinutes(key, CONFIG.mealWindow[meal].end);
const bookingCutoff = (key, meal) => atMinutes(key, CONFIG.booking[meal].cutoffHour * 60);
const bookingOpen = (key, meal, now) => Boolean(CONFIG.booking[meal]) && now < bookingCutoff(key, meal);

function currentMeal(now) {
  const minutes = minutesOfDay(now);
  return MEALS.find((meal) => minutes >= CONFIG.mealWindow[meal].start && minutes < CONFIG.mealWindow[meal].end) ?? null;
}

function upcomingMeal(now) {
  const minutes = minutesOfDay(now);
  return MEALS.find((meal) => minutes < CONFIG.mealWindow[meal].start) ?? null;
}

class ApiError extends Error {
  constructor(message, { status = 0, code = '', fields = {} } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function api(method, path, body, { quiet = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (demo.offsetMs !== 0 && CONFIG.demoClock) headers['X-Demo-Now'] = String(Date.now() + demo.offsetMs);

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch (error) {
    console.error('Network error', error);
    throw new ApiError('Cannot reach the server. Is it running?', { code: 'NETWORK' });
  }

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (response.ok) return payload;

  const failure = new ApiError(payload?.error ?? 'The request failed.', {
    status: response.status,
    code: payload?.code ?? '',
    fields: payload?.fields ?? {},
  });
  if (response.status === 401 && failure.code === 'UNAUTHENTICATED' && !quiet) handleSessionExpired();
  throw failure;
}

const session = { user: null };
const db = {
  subscriptions: [],
  coupons: [],
  bookings: [],
  scans: [],
  transactions: [],
  stats: { mealsEaten: 0, totalPaid: 0 },
};
let menus = null;
let routeData = null;
let routeToken = 0;

const LIST_DEFAULTS = {
  orders: () => ({ q: '', kind: 'ALL', mess: 'ALL', method: 'ALL', type: 'ALL', from: '', to: '', page: 1, pageSize: 25 }),
  bookings: () => ({ q: '', type: 'ALL', state: 'ALL', meal: 'ALL', from: '', to: '', page: 1, pageSize: 25 }),
};

const ui = {
  firstFloorTab: 'coupons',
  coupons: { selected: new Set() },
  booking: { selected: new Set() },
  menuMess: 'GF',
  kiosk: { mess: 'GF', finger: null, result: null },
  members: { query: '', mess: 'ALL', sortKey: 'id', sortDir: 'asc' },
  orders: LIST_DEFAULTS.orders(),
  bookings: LIST_DEFAULTS.bookings(),
};

async function loadMemberData() {
  const data = await api('GET', '/api/me/data');
  session.user = data.user;
  db.subscriptions = data.subscriptions;
  db.coupons = data.coupons;
  db.bookings = data.bookings;
  db.scans = data.scans;
  db.transactions = data.transactions;
  db.stats = data.stats;
  return null;
}

async function loadMenus() {
  menus = await api('GET', '/api/menus');
  return menus;
}

const loadOverview = () => api('GET', '/api/admin/overview');

async function loadKiosk() {
  const [fingers, recent] = await Promise.all([
    api('GET', '/api/admin/fingers'),
    api('GET', `/api/admin/kiosk/recent?mess=${ui.kiosk.mess}`),
  ]);
  return { fingers: fingers.fingers, recent: recent.scans };
}

async function loadMembers() {
  const { query, mess, sortKey, sortDir } = ui.members;
  const params = new URLSearchParams({ q: query.trim(), mess, sort: sortKey, dir: sortDir });
  const result = await api('GET', `/api/admin/members?${params}`);
  return { members: result.members };
}

function listParams(list, overrides = {}) {
  const { q, ...rest } = ui[list];
  const params = new URLSearchParams({ q: q.trim(), ...Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, String(value)])), ...overrides });
  return params;
}

const loadOrders = () => api('GET', `/api/admin/orders?${listParams('orders')}`);
const loadBookings = () => api('GET', `/api/admin/bookings?${listParams('bookings')}`);
const loadMemberDetail = () => api('GET', `/api/admin/members/${encodeURIComponent(currentParams().get('id') ?? '')}`);

const subscriptionOf = (userId, now) => db.subscriptions.find((sub) => sub.userId === userId && sub.semesterId === semesterOf(now).id);
const isSemesterMess = (messId) => messId === 'GF' || messId === 'PB';
const isSubscribed = (user, now) => isSemesterMess(user.mess) && Boolean(subscriptionOf(user.id, now));
const couponFor = (userId, date, meal) => db.coupons.find((coupon) => coupon.userId === userId && coupon.date === date && coupon.meal === meal);
const bookingFor = (userId, date, meal) =>
  db.bookings.find((booking) => booking.userId === userId && booking.date === date && booking.meal === meal && booking.status !== 'cancelled');
const ownedCouponValue = (userId, keys) =>
  db.coupons.filter((coupon) => coupon.userId === userId && keys.includes(coupon.date)).reduce((sum, coupon) => sum + coupon.price, 0);
const profileLabel = (user) => (user.category === 'staff' ? 'Staff' : YEAR_LABEL[user.year]);
const assignmentLabel = (user) => (user.mess === 'NONE' ? 'No mess selected' : MESSES[user.mess].name);
const messColor = (messId) => (MESSES[messId] ? MESSES[messId].color : 'var(--muted)');

function policyFor(user) {
  if (user.category === 'student' && user.year === 1) return { forced: 'PB', options: ['PB'], reason: 'P Block Mess is compulsory for 1st year students.' };
  if (user.category === 'student' && user.year === 2) return { forced: 'GF', options: ['GF'], reason: 'Ground Floor Mess is compulsory for 2nd year students.' };
  return { forced: null, options: ['GF', 'FF', 'NONE'], reason: '3rd and 4th year students and staff pick one option for the semester.' };
}

function mealPlanLock(user, now) {
  if (isSubscribed(user, now)) return `Your ${semesterOf(now).label} subscription is paid and cannot be changed this semester.`;
  const today = dateKey(now);
  const holdsCoupons = db.coupons.some((coupon) => coupon.status === 'active' && coupon.date >= today);
  const holdsBookings = db.bookings.some((booking) => booking.status === 'booked' && booking.date >= today);
  if (holdsCoupons || holdsBookings) return 'You still hold unused coupons or bookings. Use them before switching mess.';
  return '';
}

const chip = (label, tone = 'muted') => html`<span class="chip chip--${tone}">${label}</span>`;
const messChip = (messId) => (messId === 'NONE' ? chip('No mess') : html`<span class="chip chip--${messId.toLowerCase()}">${MESSES[messId].short}</span>`);
const EMPTY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>';
const emptyState = (title, hint) => html`<div class="empty"><span class="empty-icon">${raw(EMPTY_ICON)}</span><strong>${title}</strong><span class="muted">${hint}</span></div>`;
const tile = (label, value, hint = '', index = 0, kind = '') => html`
  <article class="card tile reveal" style="--i:${index}">
    <span class="tile-label">${label}</span>
    <span class="tile-value" ${typeof value === 'number' ? raw(`data-count="${value}" data-kind="${kind}"`) : ''}>${kind === 'rupees' ? rupees(value) : value}</span>
    <span class="tile-hint">${hint}</span>
  </article>`;
const pageHead = (title, subtitle = '', actions = '') => html`
  <header class="page-head reveal">
    <div>
      <h1>${title}</h1>
      ${subtitle ? html`<p class="muted">${subtitle}</p>` : ''}
    </div>
    ${actions}
  </header>`;
const countdownTag = (target) => html`<span data-countdown="${target.getTime()}"></span>`;
const skeletonMarkup = () => html`
  <div class="skeleton-page" aria-busy="true" aria-label="Loading">
    <div class="skeleton sk-title"></div>
    <div class="skeleton sk-sub"></div>
    <div class="grid grid--2" style="margin-top:28px"><div class="skeleton sk-card"></div><div class="skeleton sk-card"></div></div>
    <div class="grid grid--3" style="margin-top:16px"><div class="skeleton sk-tile"></div><div class="skeleton sk-tile"></div><div class="skeleton sk-tile"></div></div>
  </div>`;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionOn = () => typeof gsap !== 'undefined' && !prefersReducedMotion;
if (typeof gsap !== 'undefined') document.documentElement.classList.add('has-gsap');

function animateCounters(root) {
  $$('[data-count]', root).forEach((element) => {
    const target = Number(element.dataset.count);
    const format = (value) => (element.dataset.kind === 'rupees' ? rupees(Math.round(value)) : String(Math.round(value)));
    const state = { value: 0 };
    element.textContent = format(0);
    gsap.to(state, {
      value: target,
      duration: 1.1,
      delay: 0.2,
      ease: 'power2.out',
      onUpdate: () => {
        element.textContent = format(state.value);
      },
      onComplete: () => {
        element.textContent = format(target);
      },
    });
  });
}

function animateEntrance(root) {
  if (!motionOn()) return;
  const targets = $$('.reveal', root);
  if (targets.length > 0) {
    gsap.fromTo(targets, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06, clearProps: 'opacity,transform' });
  }
  animateCounters(root);
  $$('.bar-fill, .chart-line', root).forEach((element) => element.classList.add('is-drawn'));
}

function animateAuthEntrance() {
  if (!motionOn()) return;
  gsap.from('.hero-title .word', { opacity: 0, y: 46, rotateX: -70, transformOrigin: '0% 100%', duration: 0.9, stagger: 0.08, ease: 'back.out(1.6)' });
  gsap.from('#view-auth .reveal', { opacity: 0, y: 24, duration: 0.8, stagger: 0.09, delay: 0.15, ease: 'power3.out', clearProps: 'opacity,transform' });
}

function popElement(element) {
  if (!motionOn()) return;
  gsap.fromTo(element, { scale: 0.94 }, { scale: 1, duration: 0.45, ease: 'back.out(2.4)', clearProps: 'transform' });
}

function setAmount(element, value) {
  const from = element._amount ?? value;
  element._amount = value;
  element._tween?.kill();
  if (!motionOn() || from === value) {
    element.textContent = rupees(value);
    return;
  }
  const state = { value: from };
  element._tween = gsap.to(state, {
    value,
    duration: 0.45,
    ease: 'power2.out',
    onUpdate: () => {
      element.textContent = rupees(Math.round(state.value));
    },
    onComplete: () => {
      element.textContent = rupees(value);
    },
  });
}

const hero = { active: false, loading: false, cleanup: null };

async function startHero() {
  const canvas = $('#hero-canvas');
  if (!canvas || hero.active || hero.loading || prefersReducedMotion || window.innerWidth < 900) return;
  hero.loading = true;
  let THREE;
  try {
    THREE = await import('/vendor/three/three.module.js');
  } catch (error) {
    console.warn('Three.js failed to load, keeping the static glow.', error);
    hero.loading = false;
    return;
  }
  hero.loading = false;
  if ($('#view-auth').hidden || hero.active) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (error) {
    console.warn('WebGL is unavailable, keeping the static glow.', error);
    return;
  }
  hero.active = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
  camera.position.set(0, 0, 9.5);
  const rig = new THREE.Group();
  const spin = new THREE.Group();
  rig.add(spin);
  scene.add(rig);

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.45, 1),
    new THREE.MeshStandardMaterial({ color: 0x55557a, emissive: 0x16163a, roughness: 0.22, metalness: 0.85, flatShading: true }),
  );
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.62, 1)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }),
  );
  spin.add(core, wire);

  const orbitSpecs = [
    { color: 0x6c63ff, radius: 2.5, tiltX: 1.2, tiltZ: 0.2, speed: 0.55, phase: 0 },
    { color: 0xff6584, radius: 3.05, tiltX: 0.55, tiltZ: -0.6, speed: 0.4, phase: 2.1 },
    { color: 0x38bdf8, radius: 3.6, tiltX: 1.0, tiltZ: 0.9, speed: 0.3, phase: 4.2 },
  ];
  const satellites = orbitSpecs.map((spec) => {
    const pivot = new THREE.Group();
    pivot.rotation.set(spec.tiltX, 0, spec.tiltZ);
    const points = new THREE.EllipseCurve(0, 0, spec.radius, spec.radius).getPoints(120).map((point) => new THREE.Vector3(point.x, point.y, 0));
    pivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: spec.color, transparent: true, opacity: 0.22 })));
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 32, 32),
      new THREE.MeshStandardMaterial({ color: spec.color, emissive: spec.color, emissiveIntensity: 0.9, roughness: 0.4 }),
    );
    pivot.add(body);
    spin.add(pivot);
    return { body, spec };
  });

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  [
    [0x6c63ff, 55, [4, 3, 5]],
    [0xff6584, 40, [-5, -2, 4]],
    [0x38bdf8, 40, [0, 5, -4]],
  ].forEach(([color, intensity, position]) => {
    const light = new THREE.PointLight(color, intensity, 30);
    light.position.set(...position);
    scene.add(light);
  });

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    rig.position.x = width > 1200 ? 1.55 : 1.1;
    rig.position.y = 0.1;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const onPointerMove = (event) => {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;
    if (typeof gsap !== 'undefined') gsap.to(rig.rotation, { x: y * 0.4, y: x * 0.6, duration: 1.4, ease: 'power2.out', overwrite: 'auto' });
  };
  window.addEventListener('pointermove', onPointerMove);

  renderer.setAnimationLoop((time) => {
    spin.rotation.y = time * 0.00016;
    spin.rotation.x = Math.sin(time * 0.0003) * 0.18;
    satellites.forEach(({ body, spec }) => {
      const angle = spec.phase + time * 0.001 * spec.speed;
      body.position.set(Math.cos(angle) * spec.radius, Math.sin(angle) * spec.radius, 0);
    });
    renderer.render(scene, camera);
  });

  canvas.classList.add('is-ready');
  if (typeof gsap !== 'undefined') gsap.from(rig.scale, { x: 0.3, y: 0.3, z: 0.3, duration: 1.6, ease: 'expo.out' });

  hero.cleanup = () => {
    renderer.setAnimationLoop(null);
    window.removeEventListener('pointermove', onPointerMove);
    observer.disconnect();
    scene.traverse((object) => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material?.dispose());
    });
    renderer.dispose();
    renderer.forceContextLoss();
    const fresh = canvas.cloneNode(false);
    canvas.replaceWith(fresh);
    hero.active = false;
    hero.cleanup = null;
  };
}

function stopHero() {
  hero.cleanup?.();
}

function messCardMarkup(user, now) {
  if (user.mess === 'NONE') {
    return html`
      <article class="mess-card mess-card--empty reveal">
        <div class="mc-mid"><h2>No mess yet</h2><span class="mc-model">Choose Ground Floor or First Floor to start eating on campus.</span></div>
        <footer class="mc-bottom"><div><span class="mc-label">Member</span><strong>${user.name}</strong><span class="mc-id">${user.id}, ${profileLabel(user)}</span></div></footer>
      </article>`;
  }
  const mess = MESSES[user.mess];
  const semester = semesterOf(now);
  let status;
  let figure;
  if (isSemesterMess(user.mess)) {
    status = !isSubscribed(user, now) ? chip('Fee due', 'bad') : user.fpEnrolled ? chip('Active', 'ok') : chip('Enrol fingerprint', 'warn');
    figure = html`<span class="mc-label">Valid through</span><span class="mc-value">${MONTH_SHORT[semester.end.getMonth()]} ${semester.end.getFullYear()}</span>`;
  } else {
    const owned = ownedCouponValue(user.id, weekDateKeys(upcomingWeekStart(now)));
    status = owned >= CONFIG.weeklyMinimum ? chip('Coupons ready', 'ok') : chip('Needs coupons', 'warn');
    figure = html`<span class="mc-label">Week loaded</span><span class="mc-value">${rupees(owned)}</span>`;
  }
  return html`
    <article class="mess-card reveal" style="--tone:${mess.color}">
      <span class="mc-sheen"></span>
      <svg class="mc-glyph" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M24 70V50a26 26 0 0 1 52 0V62"/><path d="M31 74V50a19 19 0 0 1 38 0V66"/><path d="M38 70V50a12 12 0 0 1 24 0V70"/><path d="M45 66V50a5 5 0 0 1 10 0V74"/>
      </svg>
      <header class="mc-top"><span class="mc-brand">IIIT-BH Mess</span>${status}</header>
      <div class="mc-mid"><h2>${mess.name}</h2><span class="mc-model">${mess.model}</span></div>
      <footer class="mc-bottom">
        <div><span class="mc-label">Member</span><strong>${user.name}</strong><span class="mc-id">${user.id}, ${profileLabel(user)}</span></div>
        <div class="mc-right">${figure}</div>
      </footer>
    </article>`;
}

function timelineMarkup(user, now) {
  const start = 360;
  const end = 1380;
  const span = end - start;
  const segments = MEALS.map((meal) => {
    const window = CONFIG.mealWindow[meal];
    const state = mealStateFor(user, meal, now);
    const left = (((window.start - start) / span) * 100).toFixed(2);
    const width = (((window.end - window.start) / span) * 100).toFixed(2);
    return html`<div class="tl-seg tl-seg--${state.tone}" style="left:${left}%;width:${width}%"><span>${MEAL_LABEL[meal]}</span></div>`;
  });
  const ticks = [6, 9, 12, 15, 18, 21].map((hour) => html`<span style="left:${(((hour * 60 - start) / span) * 100).toFixed(2)}%">${formatClock(hour * 60)}</span>`);
  return html`
    <div class="timeline" data-start="${start}" data-end="${end}">
      <div class="tl-track">${segments}<span class="tl-needle"></span></div>
      <div class="tl-ticks">${ticks}</div>
    </div>`;
}

function updateTimelines(now) {
  $$('.timeline').forEach((timeline) => {
    const track = $('.tl-track', timeline);
    const needle = $('.tl-needle', timeline);
    const start = Number(timeline.dataset.start);
    const end = Number(timeline.dataset.end);
    const progress = (minutesOfDay(now) + now.getSeconds() / 60 - start) / (end - start);
    needle.style.opacity = progress >= 0 && progress <= 1 ? '1' : '0';
    needle.style.transform = `translateX(${Math.min(Math.max(progress, 0), 1) * track.clientWidth}px)`;
  });
}

function semesterMealState(user, meal, now) {
  if (!isSubscribed(user, now)) return { tone: 'bad', label: 'Locked', detail: 'Pay the semester fee to eat here.' };
  if (!user.fpEnrolled) return { tone: 'warn', label: 'Enrol first', detail: 'Fingerprint is needed at the entrance.' };
  const today = dateKey(now);
  const served = db.scans.find((scan) => scan.userId === user.id && scan.date === today && scan.meal === meal && scan.result === 'served');
  if (served) return { tone: 'ok', label: 'Served', detail: `Scanned at ${formatTime(wallFromIso(served.at))}.` };
  const window = CONFIG.mealWindow[meal];
  const minutes = minutesOfDay(now);
  if (minutes < window.start) return { tone: 'info', label: 'Upcoming', detail: `Opens at ${formatClock(window.start)}.` };
  if (minutes < window.end) return { tone: 'warn', label: 'Open now', detail: `Closes at ${formatClock(window.end)}.` };
  return { tone: 'muted', label: 'Not taken', detail: 'The window has closed.' };
}

function couponMealState(user, meal, now) {
  const today = dateKey(now);
  const coupon = couponFor(user.id, today, meal);
  const booking = bookingFor(user.id, today, meal);
  if (coupon?.status === 'used' || booking?.status === 'used') return { tone: 'ok', label: 'Served', detail: 'Redeemed at the counter.' };
  if (coupon) return { tone: 'ok', label: 'Coupon ready', detail: 'Quote your roll number at the counter.' };
  if (booking) return { tone: 'info', label: 'Booked', detail: 'Pre-paid, quote your roll number.' };
  const rule = CONFIG.booking[meal];
  if (rule && bookingOpen(today, meal, now)) {
    return {
      tone: 'warn',
      label: 'Not covered',
      detail: html`Book for ${rupees(rule.price)}, closes in ${countdownTag(bookingCutoff(today, meal))}.`,
    };
  }
  return { tone: 'muted', label: 'No meal', detail: rule ? 'Booking has closed.' : 'No coupon for this meal.' };
}

function mealStateFor(user, meal, now) {
  if (user.mess === 'NONE') return { tone: 'muted', label: 'No mess', detail: 'Choose a mess to eat on campus.' };
  return user.mess === 'FF' ? couponMealState(user, meal, now) : semesterMealState(user, meal, now);
}

function nextAction(user, now) {
  const semester = semesterOf(now);
  if (user.mess === 'NONE') {
    return { color: 'var(--accent)', title: 'Pick your mess', detail: 'Choose Ground Floor, First Floor or stay without a mess this semester.', cta: 'Choose mess', href: '#/mess' };
  }
  if (user.mess === 'FF') {
    const weekStart = upcomingWeekStart(now);
    const owned = ownedCouponValue(user.id, weekDateKeys(weekStart));
    const range = `${formatDay(weekStart)} to ${formatDay(addDays(weekStart, 6))}`;
    if (owned < CONFIG.weeklyMinimum) {
      return {
        color: 'var(--ff)',
        title: `Buy coupons for ${range}`,
        detail: owned
          ? `You hold ${rupees(owned)}. Add ${rupees(CONFIG.weeklyMinimum - owned)} more to reach the ${rupees(CONFIG.weeklyMinimum)} minimum.`
          : `Pick the meals you want. The weekly minimum is ${rupees(CONFIG.weeklyMinimum)}.`,
        cta: 'Open coupon planner',
        href: '#/first-floor',
      };
    }
    return {
      color: 'var(--ok)',
      title: 'Coupons are loaded',
      detail: `${rupees(owned)} ready for ${range}. Missed a coupon? Lunch books until 9:00 AM and dinner until 5:00 PM on the day.`,
      cta: 'Book a meal',
      href: '#/first-floor',
    };
  }
  if (!subscriptionOf(user.id, now)) {
    return { color: messColor(user.mess), title: 'Pay the semester fee', detail: `${rupees(CONFIG.semesterFee)} covers ${semester.label}: breakfast, lunch and dinner, 7 days a week.`, cta: 'Pay now', href: '#/mess' };
  }
  if (!user.fpEnrolled) {
    return { color: messColor(user.mess), title: 'Enrol your fingerprint', detail: 'The scanner at the entrance verifies you before every meal. Enrol once, it takes a second.', cta: 'Enrol now', href: '#/mess' };
  }
  const next = upcomingMeal(now);
  return {
    color: 'var(--ok)',
    title: currentMeal(now) ? `${MEAL_LABEL[currentMeal(now)]} is being served` : next ? `${MEAL_LABEL[next]} opens at ${formatClock(CONFIG.mealWindow[next].start)}` : 'All meals done for today',
    detail: `Place your finger on the scanner at ${MESSES[user.mess].name}. You are all set for ${semester.label}.`,
    cta: '',
    href: '',
  };
}

function renderHome(user, now) {
  const action = nextAction(user, now);
  const today = dateKey(now);
  const mealNow = currentMeal(now);
  const upcoming =
    db.coupons.filter((coupon) => coupon.status === 'active' && coupon.date >= today).length +
    db.bookings.filter((booking) => booking.status === 'booked' && booking.date >= today).length;
  const semester = semesterOf(now);
  const daysLeft = Math.max(0, Math.ceil((semester.end - now) / MS_PER_DAY));

  const thirdTile = user.mess === 'FF'
    ? tile('Upcoming meals', upcoming, 'Coupons and bookings ahead', 7)
    : isSemesterMess(user.mess)
      ? tile('Days left', daysLeft, `In ${semester.label}`, 7)
      : tile('Mess plan', 'None', 'Choose one in My mess', 7);

  return html`
    ${pageHead(`${greetingFor(now)}, ${user.name.split(' ')[0]}`, formatLong(now))}

    <section class="hero-row">
      <div class="spotlight reveal" style="--tone:${action.color}">
        <div>
          <span class="eyebrow">${action.cta ? 'Next step' : 'Status'}</span>
          <h2>${action.title}</h2>
          <p class="muted">${action.detail}</p>
        </div>
        ${action.cta ? html`<a class="btn btn--primary" href="${action.href}">${action.cta}</a>` : chip('All set', 'ok')}
      </div>
      ${messCardMarkup(user, now)}
    </section>

    <div class="section-title reveal">
      <h2>Today</h2>
      ${user.mess === 'NONE' ? '' : messChip(user.mess)}
    </div>
    <section class="card timeline-card reveal">${timelineMarkup(user, now)}</section>
    <section class="grid grid--3" style="margin-top:16px">
      ${MEALS.map((meal) => {
        const state = mealStateFor(user, meal, now);
        const window = CONFIG.mealWindow[meal];
        return html`
          <article class="card meal-card meal-card--${meal} reveal ${meal === mealNow ? 'is-now' : ''}">
            <header>
              <span class="meal-icon">${raw(MEAL_ICON[meal])}</span>
              <div class="meal-head"><span class="meal-name">${MEAL_LABEL[meal]}</span><span class="meal-time">${formatClock(window.start)} to ${formatClock(window.end)}</span></div>
              ${chip(state.label, state.tone)}
            </header>
            <p class="muted">${state.detail}</p>
          </article>`;
      })}
    </section>

    <section class="grid grid--3" style="margin-top:16px">
      ${tile('Meals eaten', db.stats.mealsEaten, 'Entries and redeemed coupons', 5)}
      ${tile('Total paid', db.stats.totalPaid, 'Across all receipts', 6, 'rupees')}
      ${thirdTile}
    </section>`;
}

function renderMyMess(user, now) {
  const semester = semesterOf(now);
  const policy = policyFor(user);
  const lock = mealPlanLock(user, now);
  const subscription = subscriptionOf(user.id, now);
  const showPlan = isSemesterMess(user.mess);
  const reason = user.mess === 'NONE' ? 'You have not picked a mess yet.' : policy.forced ? policy.reason : 'You chose this plan.';
  const scans = db.scans.filter((scan) => scan.mess !== 'FF').slice(-8).reverse();

  const choices = [
    { id: 'GF', title: 'Ground Floor', body: 'Semester subscription with fingerprint entry.', price: `${rupees(CONFIG.semesterFee)} / semester` },
    { id: 'FF', title: 'First Floor', body: 'Weekly coupons, pay only for meals you want.', price: `from ${rupees(CONFIG.weeklyMinimum)} / week` },
    { id: 'NONE', title: 'No mess', body: 'Eat outside, nothing to pay.', price: rupees(0) },
  ];

  const steps = [
    {
      state: subscription ? 'is-done' : 'is-current',
      title: `Pay ${rupees(CONFIG.semesterFee)}`,
      body: subscription ? `Paid on ${formatStamp(subscription.paidAt)}.` : `One payment covers ${semester.label}.`,
      action: subscription ? chip('Paid', 'ok') : html`<button type="button" class="btn btn--primary btn--sm" data-action="pay-semester">Pay ${rupees(CONFIG.semesterFee)}</button>`,
    },
    {
      state: user.fpEnrolled ? 'is-done' : subscription ? 'is-current' : 'is-pending',
      title: 'Enrol your fingerprint',
      body: user.fpEnrolled ? 'Your print is on file.' : 'Press and hold the scanner until the ring completes.',
      action: user.fpEnrolled ? chip('Enrolled', 'ok') : padMarkup('enroll', { label: 'Hold to enrol fingerprint', size: 'pad--sm', disabled: !subscription }),
    },
    {
      state: user.fpEnrolled ? 'is-done' : 'is-pending',
      title: 'Walk in and scan',
      body: `Verified at the ${MESSES[user.mess]?.short ?? ''} entrance before every meal.`,
      action: user.fpEnrolled ? chip('Ready', 'ok') : '',
    },
  ];

  return html`
    ${pageHead('My mess', 'Your plan, subscription and fingerprint in one place')}

    <section class="mymess-top">
      ${messCardMarkup(user, now)}
      <div class="reveal">
        <span class="eyebrow">Assigned to</span>
        <h2 class="mymess-title">${assignmentLabel(user)}</h2>
        <p class="muted">${reason}</p>
      </div>
    </section>

    ${policy.forced ? '' : html`
      <section class="card reveal" style="margin-top:24px">
        <h2>Choose how you eat</h2>
        <p class="muted">${policy.reason}</p>
        <div class="choice-grid">
          ${choices.map((choice) => html`
            <label class="choice-card">
              <input type="radio" name="mess-choice" value="${choice.id}" ${user.mess === choice.id ? raw('checked') : ''} ${lock ? raw('disabled') : ''}>
              <strong>${choice.title}</strong>
              <span class="muted">${choice.body}</span>
              <span class="price">${choice.price}</span>
            </label>`)}
        </div>
        ${lock ? html`<p class="notice notice--warn">${lock}</p>` : ''}
        <div style="margin-top:16px"><button type="button" class="btn btn--primary" data-action="save-mess" ${lock ? raw('disabled') : ''}>Save choice</button></div>
      </section>`}

    ${showPlan ? html`
      <section class="card reveal" style="margin-top:16px">
        <h2>Semester plan, ${semester.label}</h2>
        <p class="muted">${MESSES[user.mess].summary}</p>
        <ol class="stepper">
          ${steps.map((step, index) => html`
            <li class="step ${step.state}">
              <span class="step-dot">${index + 1}</span>
              <div><strong>${step.title}</strong><span class="muted">${step.body}</span></div>
              ${step.action}
            </li>`)}
        </ol>
      </section>

      <div class="section-title reveal"><h2>Recent entries</h2></div>
      ${scans.length === 0 ? emptyState('No entries yet', 'Your fingerprint scans will show up here.') : entryTable(scans)}` : ''}

    ${user.mess === 'FF' ? html`
      <section class="card reveal" style="margin-top:16px">
        <h2>Coupons and bookings</h2>
        <p class="muted">${MESSES.FF.summary}</p>
        <div style="margin-top:16px"><a class="btn btn--primary" href="#/first-floor">Open First Floor</a></div>
      </section>` : ''}`;
}

function entryTable(scans) {
  return html`
    <div class="table-wrap reveal">
      <table>
        <thead><tr><th>When</th><th>Meal</th><th>Mess</th><th>Result</th></tr></thead>
        <tbody>
          ${scans.map((scan) => html`
            <tr>
              <td>${formatStamp(scan.at)}</td>
              <td>${scan.meal ? MEAL_LABEL[scan.meal] : 'None'}</td>
              <td>${MESSES[scan.mess].short}</td>
              <td>${scan.result === 'served' ? chip('Served', 'ok') : chip(scan.reason || 'Denied', 'bad')}</td>
            </tr>`)}
        </tbody>
      </table>
    </div>`;
}

function padMarkup(mode, { label, size = '', disabled = false }) {
  return html`
    <button type="button" class="pad ${size}" data-pad="${mode}" aria-label="${label}" ${disabled ? raw('disabled') : ''}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="pad-track" cx="50" cy="50" r="46"/>
        <circle class="pad-ring" cx="50" cy="50" r="46"/>
        <g class="pad-print">
          <path d="M24 70V50a26 26 0 0 1 52 0V62"/>
          <path d="M31 74V50a19 19 0 0 1 38 0V66"/>
          <path d="M38 70V50a12 12 0 0 1 24 0V70"/>
          <path d="M45 66V50a5 5 0 0 1 10 0V74"/>
        </g>
      </svg>
      <span class="pad-scan"></span>
    </button>`;
}

function slotMarkup({ scope, state, date, meal, price, note, sub = '', attrs = '' }) {
  return html`
    <button type="button" class="slot slot--${state}" data-scope="${scope}" data-date="${date}" data-meal="${meal}" data-price="${price}" ${attrs}>
      <span class="slot-meal"><span class="slot-icon">${raw(MEAL_ICON[meal])}</span>${MEAL_LABEL[meal]}</span>
      <b>${note}</b>
      ${sub ? html`<small>${sub}</small>` : ''}
    </button>`;
}

function renderFirstFloor(user, now) {
  if (user.mess !== 'FF') return renderFirstFloorGate(user, now);
  const tabs = html`
    <div class="segmented" role="tablist" aria-label="First Floor options">
      <button type="button" role="tab" aria-selected="${String(ui.firstFloorTab === 'coupons')}" data-action="ff-tab" data-tab="coupons">Weekly coupons</button>
      <button type="button" role="tab" aria-selected="${String(ui.firstFloorTab === 'booking')}" data-action="ff-tab" data-tab="booking">Advance booking</button>
    </div>`;
  return html`
    ${pageHead('First Floor Mess', 'Weekly coupons, plus advance booking for meals you missed', tabs)}
    ${ui.firstFloorTab === 'coupons' ? couponPanel(user, now) : bookingPanel(user, now)}`;
}

function renderFirstFloorGate(user, now) {
  const policy = policyFor(user);
  if (policy.forced) {
    return html`
      ${pageHead('First Floor Mess')}
      <section class="card assignment reveal" style="--tone:${messColor(policy.forced)}">
        <div>
          <span class="eyebrow">Not available</span>
          <h2>This mess is not open to you</h2>
          <p class="muted">${policy.reason} Your meals are at ${MESSES[policy.forced].name}.</p>
        </div>
        <a class="btn btn--ghost" href="#/mess">Go to My mess</a>
      </section>`;
  }
  const lock = mealPlanLock(user, now);
  return html`
    ${pageHead('First Floor Mess')}
    <section class="card assignment reveal" style="--tone:var(--ff)">
      <div>
        <span class="eyebrow">Weekly coupons</span>
        <h2>Switch to First Floor to continue</h2>
        <p class="muted">${lock || `${MESSES.FF.summary} No semester fee, pay week by week.`}</p>
      </div>
      <button type="button" class="btn btn--primary" data-action="switch-ff" ${lock ? raw('disabled') : ''}>Use First Floor</button>
    </section>`;
}

function couponPanel(user, now) {
  const weekStart = upcomingWeekStart(now);
  const keys = weekDateKeys(weekStart);
  const owned = ownedCouponValue(user.id, keys);
  const rows = keys.map((key) => {
    const date = parseDateKey(key);
    return html`
      <div class="day-row reveal">
        <button type="button" class="day-label" data-action="toggle-day" data-scope="coupons" data-date="${key}">
          <strong>${DAY_SHORT[date.getDay()]}</strong><span>${date.getDate()} ${MONTH_SHORT[date.getMonth()]}</span>
        </button>
        ${MEALS.map((meal) => {
          const coupon = couponFor(user.id, key, meal);
          const passed = mealEnd(key, meal) <= now;
          const price = CONFIG.couponPrice[meal];
          if (coupon) return slotMarkup({ scope: 'coupons', state: 'owned', date: key, meal, price, note: coupon.status === 'used' ? 'Used' : 'Paid', attrs: raw('disabled') });
          if (passed) return slotMarkup({ scope: 'coupons', state: 'locked', date: key, meal, price, note: 'Passed', attrs: raw('disabled') });
          return slotMarkup({ scope: 'coupons', state: 'open', date: key, meal, price, note: rupees(price), attrs: raw('data-action="toggle-slot" aria-pressed="false"') });
        })}
      </div>`;
  });

  return html`
    <div class="seg-bar reveal">
      <div>
        <strong>Week of ${formatDay(weekStart)} to ${formatDay(addDays(weekStart, 6))}</strong>
        <p class="muted">${weekStart.getTime() === startOfDay(now).getTime() ? 'Sales are open today, the start of the week.' : 'Coupons are sold for the upcoming week. Saturday and Sunday are included.'}</p>
      </div>
      <div class="chip-row">
        <button type="button" class="chip-btn" data-action="preset" data-preset="full">Every meal</button>
        <button type="button" class="chip-btn" data-action="preset" data-preset="lunch-dinner">Lunch and dinner</button>
        <button type="button" class="chip-btn" data-action="preset" data-preset="weekdays">Weekdays only</button>
        <button type="button" class="chip-btn" data-action="preset" data-preset="clear">Clear</button>
      </div>
    </div>
    <div class="planner">
      <div class="day-list" id="planner-coupons">${rows}</div>
      <aside class="card summary reveal" id="summary" data-owned="${owned}">
        <h2>Weekly total</h2>
        <dl class="ledger">
          <div><dt>Already paid</dt><dd id="sum-owned">${rupees(owned)}</dd></div>
          <div><dt>Adding now <span id="sum-count"></span></dt><dd id="sum-new">${rupees(0)}</dd></div>
          <div class="ledger-total"><dt>Week total</dt><dd id="sum-total">${rupees(owned)}</dd></div>
        </dl>
        <div class="meter" id="sum-meter" style="--fill:0">
          <span class="meter-fill"></span>
          <span class="meter-mark" style="--at:${CONFIG.weeklyMinimum / fullWeekValue}"><span>${rupees(CONFIG.weeklyMinimum)} min</span></span>
        </div>
        <p class="meter-hint" id="sum-hint"></p>
        <button type="button" class="btn btn--primary btn--block" id="sum-pay" data-action="buy-coupons" disabled>Pay</button>
      </aside>
    </div>`;
}

function bookingPanel(user, now) {
  const today = startOfDay(now);
  const rows = Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(today, offset);
    const key = dateKey(date);
    return html`
      <div class="day-row day-row--2 reveal">
        <div class="day-label"><strong>${DAY_SHORT[date.getDay()]}</strong><span>${date.getDate()} ${MONTH_SHORT[date.getMonth()]}</span></div>
        ${['lunch', 'dinner'].map((meal) => bookingSlot(user, key, meal, now))}
      </div>`;
  });

  return html`
    <div class="seg-bar reveal">
      <div>
        <strong>Missed a coupon? Book the meal.</strong>
        <p class="muted">Lunch ${rupees(CONFIG.booking.lunch.price)} until 9:00 AM and dinner ${rupees(CONFIG.booking.dinner.price)} until 5:00 PM on the day. Breakfast is coupon only.</p>
      </div>
    </div>
    <div class="planner">
      <div class="day-list" id="planner-booking">${rows}</div>
      <aside class="card summary reveal" id="summary" data-owned="0">
        <h2>Your booking</h2>
        <dl class="ledger">
          <div><dt>Meals <span id="sum-count"></span></dt><dd id="sum-new">${rupees(0)}</dd></div>
          <div class="ledger-total"><dt>To pay</dt><dd id="sum-total">${rupees(0)}</dd></div>
        </dl>
        <p class="meter-hint">Booked meals can be cancelled for a full refund before the cut-off.</p>
        <button type="button" class="btn btn--primary btn--block" id="sum-pay" data-action="book-meals" disabled>Pay</button>
      </aside>
    </div>`;
}

function bookingSlot(user, key, meal, now) {
  const rule = CONFIG.booking[meal];
  const coupon = couponFor(user.id, key, meal);
  const booking = bookingFor(user.id, key, meal);
  const open = bookingOpen(key, meal, now);
  const base = { scope: 'booking', date: key, meal, price: rule.price };
  if (coupon) return slotMarkup({ ...base, state: 'owned', note: 'Coupon', attrs: raw('disabled') });
  if (booking) {
    const cancellable = booking.status === 'booked' && open;
    return slotMarkup({
      ...base,
      state: 'booked',
      note: booking.status === 'used' ? 'Used' : 'Booked',
      sub: cancellable ? 'Tap to cancel' : '',
      attrs: cancellable ? html`data-action="cancel-booking" data-booking="${booking.id}"` : raw('disabled'),
    });
  }
  if (!open) return slotMarkup({ ...base, state: 'locked', note: 'Closed', attrs: raw('disabled') });
  const sub = key === dateKey(now) ? html`closes in ${countdownTag(bookingCutoff(key, meal))}` : `till ${formatClock(rule.cutoffHour * 60)}`;
  return slotMarkup({ ...base, state: 'open', note: rupees(rule.price), sub, attrs: raw('data-action="toggle-slot" aria-pressed="false"') });
}

function syncPlanner(scope) {
  const root = $(`#planner-${scope}`);
  const summary = $('#summary');
  if (!root || !summary) return;
  const selected = ui[scope].selected;
  const present = new Set($$('.slot--open', root).map((slot) => slotKey(slot.dataset.date, slot.dataset.meal)));
  [...selected].forEach((key) => {
    if (!present.has(key)) selected.delete(key);
  });
  let newValue = 0;
  let newCount = 0;
  $$('.slot--open', root).forEach((slot) => {
    const on = selected.has(slotKey(slot.dataset.date, slot.dataset.meal));
    slot.classList.toggle('slot--selected', on);
    slot.setAttribute('aria-pressed', String(on));
    if (on) {
      newValue += Number(slot.dataset.price);
      newCount += 1;
    }
  });

  const owned = Number(summary.dataset.owned);
  const total = owned + newValue;
  const payButton = $('#sum-pay');
  setAmount($('#sum-new'), newValue);
  setAmount($('#sum-total'), total);
  $('#sum-count').textContent = newCount ? `(${newCount})` : '';
  payButton.textContent = newCount ? `Pay ${rupees(newValue)}` : 'Pay';

  if (scope === 'coupons') {
    const shortBy = CONFIG.weeklyMinimum - total;
    const meter = $('#sum-meter');
    meter.style.setProperty('--fill', Math.min(total / fullWeekValue, 1));
    meter.classList.toggle('is-met', shortBy <= 0);
    $('#sum-hint').textContent = shortBy > 0
      ? `Add ${rupees(shortBy)} more to reach the ${rupees(CONFIG.weeklyMinimum)} weekly minimum.`
      : `Minimum met. ${rupees(fullWeekValue - total)} of meals left unticked.`;
    payButton.disabled = newCount === 0 || shortBy > 0;
    return;
  }
  payButton.disabled = newCount === 0;
}

function renderMenu(user, now, data) {
  const todayIndex = (now.getDay() + 6) % 7;
  const mealNow = currentMeal(now);
  const messId = ui.menuMess;
  const editable = user.role === 'admin';
  const notes = {
    GF: 'Included in the semester plan. Fingerprint entry.',
    PB: 'Included in the semester plan. Fingerprint entry.',
    FF: 'Served against weekly coupons or advance booking.',
  };
  const tabs = html`
    <div class="segmented" role="tablist" aria-label="Choose mess">
      ${['GF', 'PB', 'FF'].map((id) => html`<button type="button" role="tab" aria-selected="${String(messId === id)}" data-action="menu-tab" data-mess="${id}">${MESSES[id].short}</button>`)}
    </div>`;

  return html`
    ${pageHead('Weekly menu', editable ? 'Click any dish to edit it. Changes save instantly for everyone.' : notes[messId], tabs)}
    <div class="table-wrap reveal">
      <table class="menu-table">
        <thead>
          <tr>
            <th>Day</th>
            ${MEALS.map((meal) => html`<th>${MEAL_LABEL[meal]}<br><span class="muted">${formatClock(CONFIG.mealWindow[meal].start)} to ${formatClock(CONFIG.mealWindow[meal].end)}</span></th>`)}
          </tr>
        </thead>
        <tbody>
          ${data[messId].map((dishes, index) => html`
            <tr class="${index === todayIndex ? 'is-today' : ''}">
              <th scope="row">${DAY_LONG[(index + 1) % 7]}${index === todayIndex ? chip('Today', 'info') : ''}</th>
              ${dishes.map((dish, mealIndex) => html`
                <td data-label="${MEAL_LABEL[MEALS[mealIndex]]}" class="${index === todayIndex && MEALS[mealIndex] === mealNow ? 'is-now' : ''}">
                  ${editable
                    ? html`<input type="text" class="cell-input" maxlength="120" value="${dish}" aria-label="${DAY_LONG[(index + 1) % 7]} ${MEAL_LABEL[MEALS[mealIndex]]}" data-change="menu-cell" data-mess="${messId}" data-day="${index}" data-meal="${MEALS[mealIndex]}">`
                    : dish}
                </td>`)}
            </tr>`)}
        </tbody>
      </table>
    </div>`;
}

function renderHistory(user, now) {
  const transactions = [...db.transactions].sort((a, b) => b.at.localeCompare(a.at));
  const passes = [
    ...db.coupons.map((coupon) => ({ date: coupon.date, meal: coupon.meal, type: 'Coupon', status: coupon.status })),
    ...db.bookings.map((booking) => ({ date: booking.date, meal: booking.meal, type: 'Booking', status: booking.status })),
  ].sort((a, b) => b.date.localeCompare(a.date) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal)).slice(0, 30);
  const scans = db.scans.filter((scan) => scan.mess !== 'FF').slice(-15).reverse();
  const statusTone = { active: 'info', booked: 'info', used: 'ok', cancelled: 'muted' };

  return html`
    ${pageHead('History', 'Receipts, coupons and entries', html`<button type="button" class="btn btn--ghost btn--sm" data-action="export-transactions">Export CSV</button>`)}

    <div class="section-title reveal"><h2>Payments</h2></div>
    ${transactions.length === 0 ? emptyState('No payments yet', 'Receipts appear here after your first payment.') : html`
      <div class="table-wrap reveal">
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Mess</th><th class="num">Amount</th><th></th></tr></thead>
          <tbody>
            ${transactions.map((txn) => html`
              <tr>
                <td>${formatStamp(txn.at)}</td>
                <td>${txn.description}</td>
                <td>${messChip(txn.mess)}</td>
                <td class="num">${rupees(txn.amount)}</td>
                <td><button type="button" class="btn btn--ghost btn--sm" data-action="receipt" data-txn="${txn.id}">Receipt</button></td>
              </tr>`)}
          </tbody>
        </table>
      </div>`}

    ${passes.length === 0 ? '' : html`
      <div class="section-title reveal"><h2>Coupons and bookings</h2></div>
      <div class="table-wrap reveal">
        <table>
          <thead><tr><th>Date</th><th>Meal</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            ${passes.map((pass) => html`
              <tr>
                <td>${formatDay(parseDateKey(pass.date))}</td>
                <td>${MEAL_LABEL[pass.meal]}</td>
                <td>${pass.type}</td>
                <td>${chip(pass.status === 'active' ? 'Ready' : pass.status[0].toUpperCase() + pass.status.slice(1), statusTone[pass.status])}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>`}

    ${scans.length === 0 ? '' : html`
      <div class="section-title reveal"><h2>Fingerprint entries</h2></div>
      ${entryTable(scans)}`}`;
}

function footfallChart(points) {
  const width = 520;
  const height = 190;
  const gutter = 28;
  const max = Math.max(1, ...points.map((point) => point.count));
  const step = (width - gutter * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((point, index) => [gutter + index * step, height - gutter - (point.count / max) * (height - gutter * 2)]);
  const line = coords.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)} ${height - gutter} L${coords[0][0].toFixed(1)} ${height - gutter} Z`;
  const gridlines = [0, 0.5, 1].map((ratio) => height - gutter - ratio * (height - gutter * 2));
  return html`
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Meals served per day over the last 7 days">
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color:var(--accent);stop-opacity:0.35"/>
          <stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/>
        </linearGradient>
      </defs>
      ${gridlines.map((y) => html`<line class="chart-grid" x1="${gutter}" x2="${width - gutter}" y1="${y}" y2="${y}"/>`)}
      <path class="chart-area" d="${area}" fill="url(#chart-fill)"/>
      <path class="chart-line" d="${line}" pathLength="1"/>
      ${coords.map(([x, y], index) => html`
        <circle class="chart-dot" cx="${x}" cy="${y}" r="4"><title>${formatDay(parseDateKey(points[index].date))}: ${points[index].count} meals</title></circle>
        <text class="chart-label" x="${x}" y="${height - 6}" text-anchor="middle">${DAY_SHORT[parseDateKey(points[index].date).getDay()]}</text>`)}
    </svg>`;
}

function renderAdmin(user, now, data) {
  const { tiles, plates, forecast, revenue, dues, footfall, recentOrders } = data;
  const revenueColor = { semesterGF: 'var(--gf)', semesterPB: 'var(--pb)', coupons: 'var(--ff)', bookings: 'var(--warn)' };
  const maxRevenue = Math.max(...revenue.map((row) => row.amount), 1);
  const forecastMax = Math.max(1, ...forecast.flatMap((day) => MEALS.map((meal) => day[meal])));
  const weekTotal = footfall.reduce((sum, point) => sum + point.count, 0);

  return html`
    ${pageHead('Overview', `${formatLong(now)}. Live numbers for all three messes.`, CONFIG.demoData ? html`<button type="button" class="btn btn--ghost btn--sm" data-action="reset-data">Reset demo data</button>` : '')}

    <section class="grid grid--4">
      ${tile('Members', tiles.members, `${tiles.staff} staff`, 1)}
      ${tile('Semester subscribers', tiles.subscribers, `${tiles.duesCount} fees pending`, 2)}
      ${tile('Coupon holders', tiles.couponHolders, 'With unused First Floor coupons', 3)}
      ${tile('Net revenue', tiles.netRevenue, 'After refunds', 4, 'rupees')}
    </section>

    <section class="grid grid--4" style="margin-top:16px">
      ${tile('Orders today', tiles.ordersToday, 'Payments placed today', 5)}
      ${tile('Upcoming bookings', tiles.upcomingBookings, 'Advance bookings from today', 6)}
      ${tile('Upcoming coupons', tiles.upcomingCoupons, 'Unused First Floor coupons', 7)}
      ${tile('Refunded', tiles.refunded, 'Cancelled bookings', 8, 'rupees')}
    </section>

    <section class="grid grid--2" style="margin-top:16px">
      <article class="card reveal">
        <div class="card-head"><h2>Footfall</h2><span class="muted">${weekTotal} meals in 7 days</span></div>
        ${footfallChart(footfall)}
      </article>
      <article class="card reveal">
        <h2>Revenue</h2>
        <p class="muted">Where the money comes from</p>
        <div class="bars">
          ${revenue.map((row) => html`
            <div class="bar" style="--tone:${revenueColor[row.key] ?? 'var(--accent)'}">
              <div class="bar-head"><span>${row.label}</span><span>${rupees(row.amount)}</span></div>
              <div class="bar-track"><div class="bar-fill" style="--fill:${Math.max(row.amount, 0) / maxRevenue}"></div></div>
            </div>`)}
        </div>
      </article>
    </section>

    <div class="section-title reveal">
      <h2>Recent orders</h2>
      <span class="chip-row"><a class="btn btn--ghost btn--sm" href="#/orders">All orders</a><a class="btn btn--ghost btn--sm" href="#/bookings">All bookings</a></span>
    </div>
    ${recentOrders.length === 0 ? emptyState('No orders yet', 'Payments show up here as students place them.') : html`
      <div class="table-wrap reveal">
        <table class="data-table">
          <thead><tr><th>Order</th><th>Student</th><th>Details</th><th>Payment</th><th class="num">Amount</th></tr></thead>
          <tbody>
            ${recentOrders.map((order) => html`
              <tr>
                <td>${orderCell(order)}</td>
                <td>${personCell(order.user)}</td>
                <td class="wrap">${order.description}</td>
                <td>${paymentCell(order)}</td>
                <td class="num">${amountCell(order.amount)}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>`}

    <div class="section-title reveal"><h2>Plates today</h2><span class="muted">Served of expected</span></div>
    <div class="table-wrap reveal">
      <table>
        <thead><tr><th>Mess</th>${MEALS.map((meal) => html`<th class="num">${MEAL_LABEL[meal]}</th>`)}</tr></thead>
        <tbody>
          ${['GF', 'PB', 'FF'].map((messId) => html`
            <tr>
              <td>${messChip(messId)}</td>
              ${MEALS.map((meal) => html`<td class="num">${plates[messId][meal].served} of ${plates[messId][meal].expected}</td>`)}
            </tr>`)}
        </tbody>
      </table>
    </div>

    <section class="grid grid--2" style="margin-top:36px">
      <div>
        <div class="section-title reveal"><h2>First Floor forecast</h2><span class="muted">Next 7 days</span></div>
        <div class="table-wrap reveal">
          <table class="heat">
            <thead><tr><th>Day</th>${MEALS.map((meal) => html`<th>${MEAL_LABEL[meal]}</th>`)}</tr></thead>
            <tbody>
              ${forecast.map((day) => html`
                <tr>
                  <th scope="row">${formatDay(parseDateKey(day.date))}</th>
                  ${MEALS.map((meal) => html`<td class="cell" style="--level:${day[meal] / forecastMax}">${day[meal]}</td>`)}
                </tr>`)}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <div class="section-title reveal"><h2>Fees pending</h2><span class="muted">${dues.length} members</span></div>
        <article class="card reveal">
          ${dues.length === 0 ? emptyState('Everyone has paid', 'No semester fees are pending.') : dues.map((member) => html`
            <div class="list-row">
              <div>${member.name}<small>${member.id}, ${profileLabel(member)}</small></div>
              <div>${messChip(member.mess)}</div>
            </div>`)}
        </article>
      </div>
    </section>`;
}

function activeFinger(data) {
  if (ui.kiosk.finger !== null) return ui.kiosk.finger;
  return data.fingers[0]?.id ?? '';
}

function renderKiosk(user, now, data) {
  const kiosk = ui.kiosk;
  const meal = currentMeal(now);
  const next = upcomingMeal(now);
  const isCounter = kiosk.mess === 'FF';
  const result = kiosk.result;
  const finger = activeFinger(data);

  const tabs = html`
    <div class="segmented" role="tablist" aria-label="Kiosk location">
      ${['GF', 'PB', 'FF'].map((id) => html`<button type="button" role="tab" aria-selected="${String(kiosk.mess === id)}" data-action="kiosk-tab" data-mess="${id}">${MESSES[id].short}${id === 'FF' ? ' counter' : ''}</button>`)}
    </div>`;

  const resultPanel = result
    ? html`
      <section class="result result--${result.ok ? 'ok' : 'bad'}" aria-live="polite">
        <span class="result-icon">
          ${result.ok
            ? raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>')
            : raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>')}
        </span>
        <h2>${result.title}</h2>
        <p>${result.detail}</p>
        ${result.user ? html`<p class="muted">${result.user.id}, ${profileLabel(result.user)}</p>` : ''}
      </section>`
    : html`
      <section class="result">
        <h2 class="muted">${isCounter ? 'Waiting for a roll number' : 'Waiting for a finger'}</h2>
        <p class="muted">${isCounter ? 'Enter an ID to redeem a coupon or booking.' : 'Hold the scanner to verify an entry.'}</p>
      </section>`;

  const input = isCounter
    ? html`
      <form class="card kiosk-form" data-form="counter" novalidate>
        <div>
          <h2>Coupon counter</h2>
          <p class="muted">Redeems a coupon or advance booking for the meal being served.</p>
        </div>
        <label class="field">
          <span>Roll number or employee ID</span>
          <input name="id" type="text" autocomplete="off" required placeholder="B524021">
        </label>
        <button type="submit" class="btn btn--primary">Verify and serve</button>
      </form>`
    : html`
      <div class="card kiosk-pad">
        <div>
          <h2>${MESSES[kiosk.mess].name}</h2>
          <p class="muted">Press and hold to scan</p>
        </div>
        ${padMarkup('kiosk', { label: 'Hold to scan fingerprint' })}
        <label class="field">
          <span>Simulate the finger of</span>
          <select data-change="kiosk-finger">
            <option value="" ${finger === '' ? raw('selected') : ''}>Unregistered finger</option>
            ${data.fingers.map((person) => html`<option value="${person.id}" ${person.id === finger ? raw('selected') : ''}>${person.name} (${person.id}, ${person.mess})</option>`)}
          </select>
        </label>
      </div>`;

  return html`
    ${pageHead('Kiosk', meal ? `${MEAL_LABEL[meal]} is being served until ${formatClock(CONFIG.mealWindow[meal].end)}.` : next ? `Between meals. ${MEAL_LABEL[next]} starts at ${formatClock(CONFIG.mealWindow[next].start)}.` : 'Service is over for today.', tabs)}
    <section class="kiosk reveal">
      ${input}
      ${resultPanel}
    </section>

    <div class="section-title reveal"><h2>Today at ${MESSES[kiosk.mess].short}</h2></div>
    ${data.recent.length === 0 ? emptyState('Nothing yet today', 'Entries show up here as they happen.') : html`
      <div class="table-wrap reveal">
        <table>
          <thead><tr><th>Time</th><th>Member</th><th>Meal</th><th>Via</th><th>Result</th></tr></thead>
          <tbody>
            ${data.recent.map((scan) => html`
              <tr>
                <td>${formatTime(wallFromIso(scan.at))}</td>
                <td>${scan.userName ?? 'Unknown'}</td>
                <td>${scan.meal ? MEAL_LABEL[scan.meal] : 'None'}</td>
                <td>${scan.via}</td>
                <td>${scan.result === 'served' ? chip('Served', 'ok') : chip(scan.reason || 'Denied', 'bad')}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>`}`;
}

function memberRows(rows) {
  if (rows.length === 0) return html`<tr><td colspan="5">${emptyState('No members match', 'Try a different name, ID or filter.')}</td></tr>`;
  return html`${rows.map((member) => html`
    <tr>
      <td>${member.id}</td>
      <td><a class="link-btn" href="#/member?id=${encodeURIComponent(member.id)}">${member.name}</a></td>
      <td>${profileLabel(member)}</td>
      <td>${messChip(member.mess)}</td>
      <td>${chip(member.plan.label, member.plan.tone)}</td>
    </tr>`)}`;
}

function renderMembers(user, now, data) {
  const { query, mess, sortKey, sortDir } = ui.members;
  const columns = [['id', 'ID'], ['name', 'Name'], ['type', 'Year'], ['mess', 'Mess'], ['plan', 'Plan status']];
  return html`
    ${pageHead('Members', 'Everyone registered across the three messes', html`<button type="button" class="btn btn--ghost btn--sm" data-action="export-members">Export CSV</button>`)}
    <div class="toolbar reveal">
      <input type="text" id="member-search" data-filter="query" placeholder="Search name or ID" value="${query}" aria-label="Search members">
      <select data-change="member-mess" aria-label="Filter by mess">
        <option value="ALL" ${mess === 'ALL' ? raw('selected') : ''}>All messes</option>
        ${['GF', 'PB', 'FF', 'NONE'].map((id) => html`<option value="${id}" ${mess === id ? raw('selected') : ''}>${id === 'NONE' ? 'No mess' : MESSES[id].name}</option>`)}
      </select>
    </div>
    <div class="table-wrap reveal">
      <table>
        <thead>
          <tr>
            ${columns.map(([key, label]) => html`
              <th aria-sort="${sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}">
                <button type="button" class="sort-btn" data-action="sort" data-key="${key}">${label}</button>
              </th>`)}
          </tr>
        </thead>
        <tbody id="members-body">${memberRows(data.members)}</tbody>
      </table>
    </div>`;
}

const STATE_TONE = { upcoming: 'info', used: 'ok', missed: 'warn', cancelled: 'bad' };
const STATE_LABEL = { upcoming: 'Upcoming', used: 'Used', missed: 'Missed', cancelled: 'Cancelled' };
const KIND_LABEL = { semester: 'Semester plan', coupons: 'Weekly coupons', booking: 'Advance booking' };
const METHOD_LABEL = { upi: 'UPI', card: 'Card' };

const personCell = (person) =>
  person
    ? html`<a class="person" href="#/member?id=${encodeURIComponent(person.id)}"><strong>${person.name}</strong><small>${person.id}, ${profileLabel(person)}</small></a>`
    : html`<span class="muted">Unknown member</span>`;
const amountCell = (amount) => html`<span class="${amount < 0 ? 'amount--refund' : ''}">${rupees(amount)}</span>`;
const paymentCell = (txn) => html`${METHOD_LABEL[txn.method] ?? 'Wallet'}${txn.paymentRef ? html`<small>${txn.paymentRef}</small>` : ''}`;
const orderCell = (txn) => html`<button type="button" class="link-btn" data-action="order-detail" data-id="${txn.id}">${txn.orderNo}</button><small>${formatStamp(txn.at)}</small>`;
const orderStatusChip = (txn) => (txn.status === 'refund' ? chip('Refund', 'warn') : chip('Paid', 'ok'));
const slotTypeChip = (type) => (type === 'coupon' ? chip('Coupon', 'ff') : chip('Booking', 'info'));
const slotStateCell = (slot) => html`${chip(STATE_LABEL[slot.state], STATE_TONE[slot.state])}${
  slot.state === 'used' && slot.usedAt ? html`<small>${formatStamp(slot.usedAt)}</small>` : slot.cancelledAt ? html`<small>${formatStamp(slot.cancelledAt)}</small>` : ''
}`;

const filterSelect = (list, key, label, options, current) => html`
  <select data-list="${list}" data-key="${key}" aria-label="${label}">
    ${options.map(([value, text]) => html`<option value="${value}" ${current === value ? raw('selected') : ''}>${text}</option>`)}
  </select>`;
const dateFilter = (list, key, label, current) => html`
  <label class="date-filter"><span>${label}</span><input type="date" data-list="${list}" data-key="${key}" value="${current}" aria-label="${label} date"></label>`;

function pager(list, data) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const first = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const last = Math.min(data.total, data.page * data.pageSize);
  return html`
    <nav class="pager" aria-label="Pagination">
      <span class="muted">${first} to ${last} of ${data.total}</span>
      <div class="pager-buttons">
        <button type="button" class="btn btn--ghost btn--sm" data-action="page" data-list="${list}" data-page="${data.page - 1}" ${data.page <= 1 ? raw('disabled') : ''}>Previous</button>
        <span class="muted">Page ${data.page} of ${pages}</span>
        <button type="button" class="btn btn--ghost btn--sm" data-action="page" data-list="${list}" data-page="${data.page + 1}" ${data.page >= pages ? raw('disabled') : ''}>Next</button>
      </div>
    </nav>`;
}

function ordersResults(data) {
  const rows = data.orders.length === 0
    ? html`<tr><td colspan="7">${emptyState('No orders match', 'Try different filters or a wider date range.')}</td></tr>`
    : html`${data.orders.map((order) => html`
        <tr>
          <td>${orderCell(order)}</td>
          <td>${personCell(order.user)}</td>
          <td><div class="stack"><span>${KIND_LABEL[order.kind]}</span>${messChip(order.mess)}</div></td>
          <td class="wrap">${order.description}${order.items.length > 1 ? html`<small>${order.items.length} items</small>` : ''}</td>
          <td>${paymentCell(order)}</td>
          <td class="num">${amountCell(order.amount)}</td>
          <td>${orderStatusChip(order)}</td>
        </tr>`)}`;
  return html`
    <section class="grid grid--4">
      ${tile('Orders', data.total, 'Matching the filters', 1)}
      ${tile('Collected', data.totals.paid, 'Payments received', 2, 'rupees')}
      ${tile('Refunded', data.totals.refunded, 'Cancelled bookings', 3, 'rupees')}
      ${tile('Net', data.totals.net, 'After refunds', 4, 'rupees')}
    </section>
    <div class="table-wrap" style="margin-top:16px">
      <table class="data-table">
        <thead><tr><th>Order</th><th>Student</th><th>Type</th><th>Details</th><th>Payment</th><th class="num">Amount</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${pager('orders', data)}`;
}

function renderOrders(user, now, data) {
  const filters = ui.orders;
  return html`
    ${pageHead('Orders', 'Every payment and refund, with who paid and how', html`<button type="button" class="btn btn--ghost btn--sm" data-action="export-orders">Export CSV</button>`)}
    <div class="toolbar reveal">
      <input type="text" data-list="orders" data-key="q" placeholder="Search student, ID, email or order no." value="${filters.q}" aria-label="Search orders">
      ${filterSelect('orders', 'kind', 'Order type', [['ALL', 'All types'], ['semester', 'Semester plans'], ['coupons', 'Weekly coupons'], ['booking', 'Advance bookings']], filters.kind)}
      ${filterSelect('orders', 'mess', 'Mess', [['ALL', 'All messes'], ['GF', MESSES.GF.name], ['PB', MESSES.PB.name], ['FF', MESSES.FF.name]], filters.mess)}
      ${filterSelect('orders', 'method', 'Payment method', [['ALL', 'Any method'], ['upi', 'UPI'], ['card', 'Card']], filters.method)}
      ${filterSelect('orders', 'type', 'Payments or refunds', [['ALL', 'Payments and refunds'], ['payment', 'Payments only'], ['refund', 'Refunds only']], filters.type)}
      <div class="date-range">${dateFilter('orders', 'from', 'From', filters.from)}${dateFilter('orders', 'to', 'To', filters.to)}</div>
      <button type="button" class="btn btn--ghost btn--sm" data-action="clear-filters" data-list="orders">Clear</button>
    </div>
    <div id="orders-results">${ordersResults(data)}</div>`;
}

function bookingsResults(data) {
  const rows = data.slots.length === 0
    ? html`<tr><td colspan="7">${emptyState('No bookings match', 'Try different filters or a wider date range.')}</td></tr>`
    : html`${data.slots.map((slot) => html`
        <tr>
          <td><strong>${formatDay(parseDateKey(slot.date))}</strong><small>${MEAL_LABEL[slot.meal]}</small></td>
          <td>${personCell(slot.user)}</td>
          <td>${slotTypeChip(slot.type)}</td>
          <td class="num">${rupees(slot.price)}</td>
          <td>${slotStateCell(slot)}</td>
          <td>${slot.createdAt ? formatStamp(slot.createdAt) : 'Not recorded'}</td>
          <td>${slot.orderNo}<small>${METHOD_LABEL[slot.method] ?? 'Wallet'}${slot.paymentRef ? `, ${slot.paymentRef}` : ''}</small></td>
        </tr>`)}`;
  return html`
    <section class="grid grid--4">
      ${tile('Upcoming', data.summary.upcoming, 'Meals still to be served', 1)}
      ${tile('Used', data.summary.used, 'Redeemed at the counter', 2)}
      ${tile('Missed', data.summary.missed, 'Not redeemed in time', 3)}
      ${tile('Cancelled', data.summary.cancelled, 'Refunded bookings', 4)}
    </section>
    <div class="table-wrap" style="margin-top:16px">
      <table class="data-table">
        <thead><tr><th>Meal</th><th>Student</th><th>Type</th><th class="num">Price</th><th>Status</th><th>Placed</th><th>Order</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${pager('bookings', data)}
    <p class="muted" style="margin-top:8px">${data.total} meals worth ${rupees(data.value)}, cancelled ones excluded from the value.</p>`;
}

function renderBookings(user, now, data) {
  const filters = ui.bookings;
  return html`
    ${pageHead('Bookings', 'First Floor coupons and advance bookings for every student', html`<button type="button" class="btn btn--ghost btn--sm" data-action="export-bookings">Export CSV</button>`)}
    <div class="toolbar reveal">
      <input type="text" data-list="bookings" data-key="q" placeholder="Search student name, ID or email" value="${filters.q}" aria-label="Search bookings">
      ${filterSelect('bookings', 'type', 'Coupon or booking', [['ALL', 'Coupons and bookings'], ['coupon', 'Coupons only'], ['booking', 'Bookings only']], filters.type)}
      ${filterSelect('bookings', 'state', 'Status', [['ALL', 'Any status'], ['upcoming', 'Upcoming'], ['used', 'Used'], ['missed', 'Missed'], ['cancelled', 'Cancelled']], filters.state)}
      ${filterSelect('bookings', 'meal', 'Meal', [['ALL', 'All meals'], ...MEALS.map((meal) => [meal, MEAL_LABEL[meal]])], filters.meal)}
      <div class="date-range">${dateFilter('bookings', 'from', 'From', filters.from)}${dateFilter('bookings', 'to', 'To', filters.to)}</div>
      <button type="button" class="btn btn--ghost btn--sm" data-action="clear-filters" data-list="bookings">Clear</button>
    </div>
    <div id="bookings-results">${bookingsResults(data)}</div>`;
}

const factRow = (label, value) => html`<div><dt>${label}</dt><dd>${value}</dd></div>`;

function renderMemberDetail(user, now, data) {
  const { member, stats, transactions, coupons, bookings, scans, subscriptions } = data;
  const currentSemester = semesterOf(now);
  const subscription = subscriptions.find((sub) => sub.semesterId === currentSemester.id);
  const slots = [
    ...coupons.map((coupon) => ({ ...coupon, type: 'coupon' })),
    ...bookings.map((booking) => ({ ...booking, type: 'booking' })),
  ].sort((a, b) => b.date.localeCompare(a.date) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
  const memberScans = scans.slice(0, 30);

  return html`
    ${pageHead(member.name, `${member.id}, ${member.category === 'staff' ? 'Staff' : `Student, ${profileLabel(member)}`}`, html`<a class="btn btn--ghost btn--sm" href="#/members">All members</a>`)}

    <section class="grid grid--4">
      ${tile('Total paid', stats.paid, `${stats.orders} ${stats.orders === 1 ? 'order' : 'orders'}`, 1, 'rupees')}
      ${tile('Refunded', stats.refunded, 'Cancelled bookings', 2, 'rupees')}
      ${tile('Net spend', stats.net, 'After refunds', 3, 'rupees')}
      ${tile('Meals eaten', stats.mealsEaten, 'Fingerprint and counter', 4)}
    </section>

    <section class="grid grid--2" style="margin-top:16px">
      <article class="card reveal">
        <h2>Profile</h2>
        <dl class="facts">
          ${factRow('Name', member.name)}
          ${factRow('ID', member.id)}
          ${factRow('Category', member.category === 'staff' ? 'Staff' : `Student, ${profileLabel(member)}`)}
          ${factRow('Email', member.email)}
          ${factRow('Phone', member.phone)}
          ${factRow('Registered', formatStamp(member.createdAt))}
          ${factRow('Last signed in', member.lastLoginAt ? formatStamp(member.lastLoginAt) : 'Never')}
          ${factRow('Sign ins', member.loginCount)}
        </dl>
      </article>
      <article class="card reveal">
        <h2>Mess plan</h2>
        <dl class="facts">
          ${factRow('Mess', messChip(member.mess))}
          ${factRow('Plan status', chip(member.plan.label, member.plan.tone))}
          ${isSemesterMess(member.mess) ? factRow(currentSemester.label, subscription ? html`Paid ${formatStamp(subscription.paidAt)}` : 'Fee not paid') : ''}
          ${isSemesterMess(member.mess) ? factRow('Fingerprint', member.fpEnrolled ? html`Enrolled${member.fpEnrolledAt ? ` ${formatStamp(member.fpEnrolledAt)}` : ''}` : 'Not enrolled') : ''}
          ${factRow('Profile updated', formatStamp(member.updatedAt))}
        </dl>
      </article>
    </section>

    <div class="section-title reveal"><h2>Orders</h2><span class="muted">${transactions.length} records</span></div>
    ${transactions.length === 0 ? emptyState('No orders yet', 'Payments and refunds appear here.') : html`
      <div class="table-wrap reveal">
        <table class="data-table">
          <thead><tr><th>Order</th><th>Type</th><th>Details</th><th>Payment</th><th class="num">Amount</th><th>Status</th></tr></thead>
          <tbody>
            ${transactions.map((txn) => html`
              <tr>
                <td>${orderCell(txn)}</td>
                <td><div class="stack"><span>${KIND_LABEL[txn.kind]}</span>${messChip(txn.mess)}</div></td>
                <td class="wrap">${txn.description}${txn.items.length > 1 ? html`<small>${txn.items.length} items</small>` : ''}</td>
                <td>${paymentCell(txn)}</td>
                <td class="num">${amountCell(txn.amount)}</td>
                <td>${orderStatusChip(txn)}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>`}

    ${slots.length === 0 ? '' : html`
      <div class="section-title reveal"><h2>Coupons and bookings</h2><span class="muted">${slots.length} meals</span></div>
      <div class="table-wrap reveal">
        <table class="data-table">
          <thead><tr><th>Meal</th><th>Type</th><th class="num">Price</th><th>Status</th><th>Placed</th></tr></thead>
          <tbody>
            ${slots.map((slot) => html`
              <tr>
                <td><strong>${formatDay(parseDateKey(slot.date))}</strong><small>${MEAL_LABEL[slot.meal]}</small></td>
                <td>${slotTypeChip(slot.type)}</td>
                <td class="num">${rupees(slot.price)}</td>
                <td>${slotStateCell(slot)}</td>
                <td>${slot.createdAt ? formatStamp(slot.createdAt) : 'Not recorded'}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>`}

    ${memberScans.length === 0 ? '' : html`
      <div class="section-title reveal"><h2>Entries</h2><span class="muted">Latest ${memberScans.length}</span></div>
      ${entryTable(memberScans)}`}`;
}

const ROUTES = {
  '/home': { roles: ['member'], label: 'Home', load: loadMemberData, render: renderHome, live: true },
  '/mess': { roles: ['member'], label: 'My mess', load: loadMemberData, render: renderMyMess },
  '/first-floor': { roles: ['member'], label: 'First Floor', load: loadMemberData, render: renderFirstFloor, after: () => syncPlanner(ui.firstFloorTab) },
  '/menu': { roles: ['member', 'admin'], label: 'Menu', load: loadMenus, render: renderMenu },
  '/history': { roles: ['member'], label: 'History', load: loadMemberData, render: renderHistory },
  '/admin': { roles: ['admin'], label: 'Overview', load: loadOverview, render: renderAdmin, live: true },
  '/kiosk': { roles: ['admin'], label: 'Kiosk', load: loadKiosk, render: renderKiosk, live: true },
  '/members': { roles: ['admin'], label: 'Members', load: loadMembers, render: renderMembers },
  '/member': { roles: ['admin'], label: 'Member', parent: '/members', load: loadMemberDetail, render: renderMemberDetail },
  '/orders': { roles: ['admin'], label: 'Orders', load: loadOrders, render: renderOrders },
  '/bookings': { roles: ['admin'], label: 'Bookings', load: loadBookings, render: renderBookings },
};

const NAV = {
  member: ['/home', '/mess', '/first-floor', '/menu', '/history'],
  admin: ['/admin', '/bookings', '/orders', '/members', '/kiosk', '/menu'],
};

const homePathFor = (user) => (user.role === 'admin' ? '/admin' : '/home');
const currentHash = () => location.hash.replace(/^#/, '');
const currentPath = () => currentHash().split('?')[0] || '/';
const currentParams = () => new URLSearchParams(currentHash().split('?')[1] ?? '');

function navigate(path) {
  if (currentPath() === path) {
    route().catch(reportFailure);
    return;
  }
  location.hash = path;
}

function positionNavBar() {
  const bar = $('#nav-bar');
  const active = $('.nav-link[aria-current="page"]');
  if (!bar || !active || $('#nav').hidden) return;
  const x = active.offsetLeft + 12;
  const scaleX = (active.offsetWidth - 24) / 100;
  if (!motionOn() || !bar.dataset.ready) {
    bar.style.transform = `translateX(${x}px) scaleX(${scaleX})`;
    bar.dataset.ready = 'true';
    return;
  }
  gsap.to(bar, { x, scaleX, duration: 0.55, ease: 'expo.out', overwrite: 'auto' });
}

function renderNav(user, path) {
  $('#nav').hidden = false;
  const activeTarget = ROUTES[path]?.parent ?? path;
  mount($('#nav-links'), html`${NAV[user.role].map((target) => html`<a class="nav-link" href="#${target}" ${target === activeTarget ? raw('aria-current="page"') : ''}>${ROUTES[target].label}</a>`)}`);
  requestAnimationFrame(() => requestAnimationFrame(positionNavBar));
}

function setAurora(messId) {
  const [first, second] = AURORA[messId] ?? AURORA.NONE;
  document.body.style.setProperty('--aurora-1', first);
  document.body.style.setProperty('--aurora-2', second);
}

function hideBoot() {
  const boot = $('#boot');
  if (!boot || boot.hidden) return;
  boot.classList.add('is-leaving');
  setTimeout(() => {
    boot.hidden = true;
  }, 400);
}

function showAuth() {
  $('#view-app').hidden = true;
  $('#view-auth').hidden = false;
  $('#nav').hidden = true;
  delete $('#nav-bar').dataset.ready;
  $('#user-chip').hidden = true;
  document.title = 'IIIT Bhubaneswar Mess Management';
  setAurora('NONE');
  updatePolicyPreview();
  hideBoot();
  animateAuthEntrance();
  setTimeout(startHero, 250);
}

async function route() {
  const user = session.user;
  if (!user) {
    showAuth();
    return;
  }
  const path = currentPath();
  const entry = ROUTES[path];
  if (!entry || !entry.roles.includes(user.role)) {
    location.replace(`#${homePathFor(user)}`);
    return;
  }

  stopHero();
  $('#view-auth').hidden = true;
  $('#view-app').hidden = false;
  $('#user-chip').hidden = false;
  $('#user-initials').textContent = initialsOf(user.name);
  document.title = `${entry.label} | IIIT-BH Mess`;
  setAurora(user.mess);
  renderNav(user, path);
  window.scrollTo(0, 0);

  const token = ++routeToken;
  const skeletonTimer = setTimeout(() => mount($('#view-app'), skeletonMarkup()), 140);
  try {
    routeData = await entry.load();
  } catch (error) {
    clearTimeout(skeletonTimer);
    if (token !== routeToken || !session.user) return;
    mount($('#view-app'), html`
      <div class="empty" style="margin-top:48px">
        <span class="empty-icon">${raw(EMPTY_ICON)}</span>
        <strong>Could not load this page</strong>
        <span class="muted">${error.message}</span>
        <button type="button" class="btn btn--primary btn--sm" data-action="retry">Try again</button>
      </div>`);
    hideBoot();
    return;
  }
  clearTimeout(skeletonTimer);
  if (token !== routeToken) return;
  renderCurrent({ animate: true });
  hideBoot();
}

function renderCurrent({ animate = false } = {}) {
  const user = session.user;
  const entry = ROUTES[currentPath()];
  if (!user || !entry) return;
  const now = clock.now();
  const view = $('#view-app');
  view.classList.toggle('view--static', !animate);
  mount(view, entry.render(user, now, routeData));
  entry.after?.(user, now);
  setAurora(user.mess);
  updateCountdowns(now);
  updateTimelines(now);
  if (animate) animateEntrance(view);
}

async function refresh({ animate = false } = {}) {
  const entry = ROUTES[currentPath()];
  if (!session.user || !entry) return;
  routeData = await entry.load();
  renderCurrent({ animate });
}

function handleSessionExpired() {
  session.user = null;
  stopHero();
  showAuth();
  toast('Your session expired. Please sign in again.', 'warn');
}

function toast(message, tone = 'ok') {
  const node = document.createElement('div');
  node.className = `toast toast--${tone}`;
  node.textContent = message;
  $('#toasts').append(node);
  setTimeout(() => node.classList.add('is-leaving'), 3400);
  setTimeout(() => node.remove(), 3800);
}

function confirmAction({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const dialog = $('#confirm-dialog');
    const okButton = $('#confirm-ok');
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message;
    okButton.textContent = confirmLabel;
    okButton.classList.toggle('btn--danger', danger);
    okButton.classList.toggle('btn--primary', !danger);
    dialog.returnValue = 'no';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true });
    dialog.showModal();
  });
}

let paymentFlow = null;

function requestPayment({ title, amount, lines, submit }) {
  return new Promise((resolve) => {
    const dialog = $('#pay-dialog');
    const form = $('#pay-form');
    form.reset();
    clearErrors(form);
    togglePayFields('upi');
    $('#pay-error').textContent = '';
    $('#pay-title').textContent = title;
    mount($('#pay-summary'), html`
      <span class="muted">Amount to pay</span>
      <span class="amount">${rupees(amount)}</span>
      <ul>${lines.map((line) => html`<li>${line}</li>`)}</ul>`);
    const submitButton = $('#pay-submit');
    submitButton.disabled = false;
    submitButton.textContent = `Pay ${rupees(amount)}`;
    paymentFlow = { resolve, submit, label: submitButton.textContent };
    dialog.showModal();
  });
}

function togglePayFields(method) {
  $('#pay-upi').hidden = method !== 'upi';
  $('#pay-card').hidden = method !== 'card';
}

function validatePayment(method, data) {
  const errors = {};
  if (method === 'upi') {
    if (!/^[\w.-]{2,}@[a-z]{2,}$/i.test(String(data.get('upi')).trim())) errors.upi = 'Enter a valid UPI ID like name@bank.';
    return errors;
  }
  const digits = String(data.get('card')).replace(/\s/g, '');
  if (!/^\d{16}$/.test(digits)) errors.card = 'Enter the 16 digit card number.';
  const expiry = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(String(data.get('expiry')).trim());
  if (!expiry) {
    errors.expiry = 'Use MM/YY.';
  } else if (new Date(2000 + Number(expiry[2]), Number(expiry[1]), 1) <= new Date()) {
    errors.expiry = 'This card has expired.';
  }
  if (!/^\d{3}$/.test(String(data.get('cvv')))) errors.cvv = 'Enter the 3 digit CVV.';
  return errors;
}

function readPayment(data, method) {
  if (method === 'upi') return { method, upi: String(data.get('upi')).trim() };
  return { method, card: String(data.get('card')).replace(/\s/g, ''), expiry: String(data.get('expiry')).trim(), cvv: String(data.get('cvv')) };
}

async function handlePay(form) {
  const flow = paymentFlow;
  if (!flow) return;
  const data = new FormData(form);
  const method = String(data.get('method'));
  clearErrors(form);
  $('#pay-error').textContent = '';
  const errors = validatePayment(method, data);
  const failed = Object.keys(errors);
  if (failed.length > 0) {
    failed.forEach((name) => setFieldError(form, name, errors[name]));
    return;
  }

  const submitButton = $('#pay-submit');
  submitButton.disabled = true;
  submitButton.textContent = 'Processing...';
  try {
    await delay(700);
    const result = await flow.submit(readPayment(data, method));
    paymentFlow = null;
    $('#pay-dialog').close();
    flow.resolve(result);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    Object.entries(error.fields).forEach(([key, message]) => setFieldError(form, key.split('.').pop(), message));
    $('#pay-error').textContent = error.message;
    submitButton.disabled = false;
    submitButton.textContent = flow.label;
  }
}

function setFieldError(form, name, message) {
  const holder = form.querySelector(`[data-error-for="${name}"]`);
  const input = form.elements[name];
  if (holder) holder.textContent = message;
  const isSingle = input && !(input instanceof RadioNodeList);
  const field = isSingle ? input.closest('.field') : null;
  if (field) field.classList.toggle('field--invalid', Boolean(message));
  if (isSingle) input.setAttribute('aria-invalid', String(Boolean(message)));
}

function clearErrors(form) {
  $$('[data-error-for]', form).forEach((holder) => {
    holder.textContent = '';
  });
  $$('.field--invalid', form).forEach((field) => field.classList.remove('field--invalid'));
}

function showReceipt(transaction) {
  const methodLabel = transaction.method === 'card' ? 'Card' : transaction.method === 'upi' ? 'UPI' : 'Wallet';
  mount($('#sheet-body'), html`
    <div class="receipt">
      <div class="receipt-head">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a2 2 0 0 0 2 2v9"/><path d="M10 3v7"/><path d="M6 3v7"/><path d="M17 3c-2 2-3 4.5-3 7.5 0 1.4 1 2.5 3 2.5v8"/></svg>
        </span>
        <div><strong>IIIT Bhubaneswar Mess</strong><br><span class="muted">${transaction.amount < 0 ? 'Refund receipt' : 'Payment receipt'}</span></div>
      </div>
      <dl>
        <div><dt>Order no.</dt><dd>${transaction.orderNo}</dd></div>
        <div><dt>Date</dt><dd>${formatStamp(transaction.at)}</dd></div>
        <div><dt>Member</dt><dd>${session.user.name} (${session.user.id})</dd></div>
        <div><dt>For</dt><dd>${transaction.description}</dd></div>
        <div><dt>Mess</dt><dd>${MESSES[transaction.mess].name}</dd></div>
        <div><dt>Method</dt><dd>${methodLabel}${transaction.paymentRef ? `, ${transaction.paymentRef}` : ''}</dd></div>
      </dl>
      <div class="receipt-total"><span>${transaction.amount < 0 ? 'Refunded' : 'Total paid'}</span><span>${rupees(Math.abs(transaction.amount))}</span></div>
      <div class="dialog-actions">
        <button type="button" class="btn btn--ghost" data-action="print">Print</button>
        <button type="button" class="btn btn--primary" data-action="close-dialog">Done</button>
      </div>
    </div>`);
  $('#sheet-dialog').showModal();
}

function showOrder(order, contact) {
  const isRefund = order.amount < 0;
  const original = isRefund ? routeData?.orders?.find((entry) => entry.id === order.refundOf) ?? routeData?.transactions?.find((entry) => entry.id === order.refundOf) : null;
  mount($('#sheet-body'), html`
    <div class="receipt">
      <div class="dialog-head">
        <div><span class="muted">${isRefund ? 'Refund' : 'Order'}</span><h2>${order.orderNo}</h2></div>
        ${orderStatusChip(order)}
      </div>
      <dl>
        <div><dt>Placed</dt><dd>${formatStamp(order.at)}</dd></div>
        ${contact ? html`
          <div><dt>Student</dt><dd><a class="link-btn" href="#/member?id=${encodeURIComponent(contact.id)}" data-action="close-dialog">${contact.name} (${contact.id})</a></dd></div>
          <div><dt>Email</dt><dd>${contact.email}</dd></div>
          <div><dt>Phone</dt><dd>${contact.phone}</dd></div>` : ''}
        <div><dt>Mess</dt><dd>${MESSES[order.mess].name}</dd></div>
        <div><dt>Payment</dt><dd>${METHOD_LABEL[order.method] ?? 'Wallet'}${order.paymentRef ? `, ${order.paymentRef}` : ''}</dd></div>
        ${original ? html`<div><dt>Refund for</dt><dd>${original.orderNo}</dd></div>` : ''}
      </dl>
      <ul class="order-items">
        ${order.items.map((item) => html`<li><span>${item.label}</span><span>${amountCell(item.amount)}</span></li>`)}
      </ul>
      <div class="receipt-total"><span>${isRefund ? 'Refunded' : 'Total paid'}</span><span>${rupees(Math.abs(order.amount))}</span></div>
      <div class="dialog-actions">
        <button type="button" class="btn btn--ghost" data-action="print">Print</button>
        <button type="button" class="btn btn--primary" data-action="close-dialog">Done</button>
      </div>
    </div>`);
  $('#sheet-dialog').showModal();
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const padState = { active: null, frame: 0, startedAt: 0 };

function beginHold(element) {
  if (padState.active || element.disabled) return;
  padState.active = element;
  padState.startedAt = performance.now();
  element.classList.add('pad--scanning');
  const step = () => {
    const progress = Math.min((performance.now() - padState.startedAt) / CONFIG.scanHoldMs, 1);
    element.style.setProperty('--p', progress);
    if (progress >= 1) {
      finishHold();
      return;
    }
    padState.frame = requestAnimationFrame(step);
  };
  padState.frame = requestAnimationFrame(step);
}

function endHold() {
  if (!padState.active) return;
  cancelAnimationFrame(padState.frame);
  const element = padState.active;
  padState.active = null;
  element.classList.remove('pad--scanning');
  element.style.setProperty('--p', 0);
}

function finishHold() {
  const mode = padState.active.dataset.pad;
  endHold();
  if (mode === 'enroll') enrollFingerprint().catch(reportFailure);
  if (mode === 'kiosk') runKioskScan().catch(reportFailure);
}

async function enrollFingerprint() {
  const { user } = await api('POST', '/api/me/fingerprint');
  session.user = user;
  toast('Fingerprint enrolled. You can now scan in.');
  await refresh();
}

async function runKioskScan() {
  const data = routeData;
  const { result } = await api('POST', '/api/admin/kiosk/scan', { mess: ui.kiosk.mess, fingerId: activeFinger(data) });
  ui.kiosk.result = result;
  await refresh();
}

function updateClockChip(now) {
  const chipElement = $('#clock-chip');
  const simulated = clock.isSimulated();
  chipElement.hidden = !CONFIG.demoClock;
  chipElement.classList.toggle('is-simulated', simulated);
  $('#clock-text').textContent = `${formatDay(now)}, ${formatTime(now)}${simulated ? ' (demo)' : ''}`;
}

function updateCountdowns(now) {
  $$('[data-countdown]').forEach((element) => {
    element.textContent = formatCountdown(Number(element.dataset.countdown) - now.getTime());
  });
}

let lastMinute = -1;

function tick() {
  const now = clock.now();
  updateClockChip(now);
  updateCountdowns(now);
  updateTimelines(now);
  const minute = Math.floor(now.getTime() / 60000);
  if (minute === lastMinute) return;
  const shouldRefresh = lastMinute !== -1 && shouldAutoRefresh();
  lastMinute = minute;
  if (shouldRefresh) refresh().catch(reportFailure);
}

function shouldAutoRefresh() {
  const entry = ROUTES[currentPath()];
  return Boolean(session.user && entry?.live && !padState.active && !$('dialog[open]'));
}

function setAuthTab(tab) {
  const isLogin = tab === 'login';
  $('#login-form').hidden = !isLogin;
  $('#register-form').hidden = isLogin;
  $('#tab-login').setAttribute('aria-selected', String(isLogin));
  $('#tab-register').setAttribute('aria-selected', String(!isLogin));
}

async function handleLogin(form) {
  const data = new FormData(form);
  const id = String(data.get('id')).trim().toUpperCase();
  const password = String(data.get('password'));
  const holder = form.querySelector('[data-error-for="login"]');
  if (!id || !password) {
    holder.textContent = 'Enter your ID and password.';
    return;
  }
  holder.textContent = '';
  try {
    const { user } = await api('POST', '/api/auth/login', { id, password }, { quiet: true });
    form.reset();
    startSession(user);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    holder.textContent = error.message;
  }
}

function startSession(user) {
  session.user = user;
  ui.coupons.selected.clear();
  ui.booking.selected.clear();
  ui.kiosk.result = null;
  toast(`Welcome, ${user.name.split(' ')[0]}.`);
  navigate(homePathFor(user));
}

async function logout() {
  try {
    await api('POST', '/api/auth/logout', undefined, { quiet: true });
  } catch (error) {
    console.warn('Sign out request failed, clearing the local session anyway.', error);
  }
  session.user = null;
  location.hash = '';
  await route();
}

const REGISTER_RULES = {
  name: (value) => (/^[A-Za-z][A-Za-z .'-]{2,59}$/.test(value) ? '' : 'Use 3 to 60 letters, spaces or dots.'),
  id: (value, data) => {
    const id = value.toUpperCase();
    if (data.get('category') === 'staff') return /^E\d{4}$/.test(id) ? '' : 'Employee ID looks like E1042.';
    return /^[A-Z]\d{6}$/.test(id) ? '' : 'Roll number looks like B526001.';
  },
  year: (value, data) => (data.get('category') === 'staff' || /^[1-4]$/.test(value) ? '' : 'Select your year of study.'),
  email: (value) => (/^[a-z0-9._-]+@iiit-bh\.ac\.in$/i.test(value) ? '' : 'Use your @iiit-bh.ac.in address.'),
  phone: (value) => (/^[6-9]\d{9}$/.test(value) ? '' : 'Enter a 10 digit mobile number.'),
  password: (value) => (value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value) ? '' : 'At least 8 characters with a letter and a digit.'),
  confirm: (value, data) => (value === data.get('password') ? '' : 'Passwords do not match.'),
};

function validateRegisterField(form, name) {
  const rule = REGISTER_RULES[name];
  if (!rule) return '';
  const data = new FormData(form);
  const rawValue = String(data.get(name) ?? '');
  const value = name === 'password' || name === 'confirm' ? rawValue : rawValue.trim();
  const message = rule(value, data);
  setFieldError(form, name, message);
  return message;
}

function passwordStrength(value) {
  const checks = [value.length >= 8, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)];
  return value ? checks.filter(Boolean).length : 0;
}

function updateStrength(value) {
  const level = passwordStrength(value);
  $('#strength').dataset.level = level;
  $('#strength-label').textContent = ['Password strength', 'Weak', 'Okay', 'Good', 'Strong'][level];
}

function updatePolicyPreview() {
  const form = $('#register-form');
  const data = new FormData(form);
  const isStaff = data.get('category') === 'staff';
  $('#year-field').hidden = isStaff;
  $('#id-label').textContent = isStaff ? 'Employee ID' : 'Roll number';
  form.elements.id.placeholder = isStaff ? 'E1042' : 'B526001';
  const year = Number(data.get('year'));
  let message = '3rd and 4th year students and staff choose Ground Floor, First Floor or no mess after signing in.';
  if (!isStaff && year === 1) message = `P Block Mess is compulsory for you. ${rupees(CONFIG.semesterFee)} per semester with fingerprint entry.`;
  if (!isStaff && year === 2) message = `Ground Floor Mess is compulsory for you. ${rupees(CONFIG.semesterFee)} per semester with fingerprint entry.`;
  $('#policy-preview').textContent = message;
}

async function handleRegister(form) {
  const failed = Object.keys(REGISTER_RULES).filter((name) => validateRegisterField(form, name));
  if (failed.length > 0) {
    form.elements[failed[0]].focus();
    return;
  }

  const data = new FormData(form);
  const isStaff = data.get('category') === 'staff';
  const body = {
    category: String(data.get('category')),
    name: String(data.get('name')).trim(),
    id: String(data.get('id')).trim().toUpperCase(),
    email: String(data.get('email')).trim().toLowerCase(),
    phone: String(data.get('phone')).trim(),
    password: String(data.get('password')),
  };
  if (!isStaff) body.year = Number(data.get('year'));

  try {
    const { user } = await api('POST', '/api/auth/register', body, { quiet: true });
    form.reset();
    updateStrength('');
    updatePolicyPreview();
    setAuthTab('login');
    startSession(user);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    const entries = Object.entries(error.fields);
    if (entries.length === 0) {
      toast(error.message, 'bad');
      return;
    }
    entries.forEach(([key, message]) => setFieldError(form, key.split('.').pop(), message));
  }
}

function openClock() {
  $('#clock-form').elements.when.value = toLocalInputValue(clock.now());
  $('#clock-dialog').showModal();
}

async function applyClock(target) {
  demo.offsetMs = target ? fromWall(target) - Date.now() : 0;
  saveDemoOffset();
  $('#clock-dialog').close();
  lastMinute = -1;
  tick();
  await refresh();
  toast(target ? `Demo clock set to ${formatDay(target)}, ${formatTime(target)}.` : 'Using live time.', 'warn');
}

async function handleClock(form) {
  const value = String(new FormData(form).get('when'));
  const target = new Date(value);
  if (!value || Number.isNaN(target.getTime())) {
    toast('Pick a valid date and time.', 'bad');
    return;
  }
  await applyClock(target);
}

function toggleSlot(button) {
  const selected = ui[button.dataset.scope].selected;
  const key = slotKey(button.dataset.date, button.dataset.meal);
  if (selected.has(key)) selected.delete(key);
  else selected.add(key);
  syncPlanner(button.dataset.scope);
  popElement(button);
}

function toggleDay(button) {
  const selected = ui.coupons.selected;
  const openSlots = $$('.slot--open', button.closest('.day-row'));
  if (openSlots.length === 0) return;
  const keys = openSlots.map((slot) => slotKey(slot.dataset.date, slot.dataset.meal));
  const allOn = keys.every((key) => selected.has(key));
  keys.forEach((key) => (allOn ? selected.delete(key) : selected.add(key)));
  syncPlanner('coupons');
  openSlots.forEach(popElement);
}

function applyPreset(button) {
  const rules = {
    full: () => true,
    'lunch-dinner': (slot) => slot.dataset.meal !== 'breakfast',
    weekdays: (slot) => {
      const day = parseDateKey(slot.dataset.date).getDay();
      return day >= 1 && day <= 5;
    },
    clear: () => false,
  };
  const selected = ui.coupons.selected;
  selected.clear();
  $$('#planner-coupons .slot--open').filter(rules[button.dataset.preset]).forEach((slot) => selected.add(slotKey(slot.dataset.date, slot.dataset.meal)));
  syncPlanner('coupons');
}

const selectedSlots = (scope) => [...ui[scope].selected].map(parseSlot);

async function buyCoupons() {
  const slots = selectedSlots('coupons');
  const total = slots.reduce((sum, slot) => sum + CONFIG.couponPrice[slot.meal], 0);
  const counts = MEALS.map((meal) => [meal, slots.filter((slot) => slot.meal === meal).length]).filter(([, count]) => count > 0);
  const result = await requestPayment({
    title: 'Weekly coupons',
    amount: total,
    lines: [`${slots.length} meals, First Floor Mess`, counts.map(([meal, count]) => `${count} ${MEAL_LABEL[meal].toLowerCase()}`).join(', ')],
    submit: (payment) => api('POST', '/api/coupons', { slots, payment }),
  });
  if (!result) return;
  ui.coupons.selected.clear();
  await refresh();
  showReceipt(result.transaction);
}

async function bookMeals() {
  const slots = selectedSlots('booking');
  const total = slots.reduce((sum, slot) => sum + CONFIG.booking[slot.meal].price, 0);
  const result = await requestPayment({
    title: 'Advance booking',
    amount: total,
    lines: slots.map((slot) => `${MEAL_LABEL[slot.meal]}, ${formatDay(parseDateKey(slot.date))}`),
    submit: (payment) => api('POST', '/api/bookings', { slots, payment }),
  });
  if (!result) return;
  ui.booking.selected.clear();
  await refresh();
  showReceipt(result.transaction);
}

async function cancelBooking(button) {
  const booking = db.bookings.find((entry) => entry.id === button.dataset.booking);
  if (!booking) return;
  const label = `${MEAL_LABEL[booking.meal]} on ${formatDay(parseDateKey(booking.date))}`;
  const confirmed = await confirmAction({ title: 'Cancel this booking?', message: `${label}. ${rupees(booking.price)} is refunded in full.`, confirmLabel: 'Cancel booking', danger: true });
  if (!confirmed) return;
  const result = await api('DELETE', `/api/bookings/${booking.id}`);
  await refresh();
  toast(`${rupees(booking.price)} refunded.`);
  showReceipt(result.transaction);
}

async function paySemester() {
  const user = session.user;
  const semester = semesterOf(clock.now());
  const result = await requestPayment({
    title: `${MESSES[user.mess].name} plan`,
    amount: CONFIG.semesterFee,
    lines: [`${semester.label} semester`, 'Breakfast, lunch and dinner, 7 days a week'],
    submit: (payment) => api('POST', '/api/me/subscription', { payment }),
  });
  if (!result) return;
  await refresh();
  showReceipt(result.transaction);
}

async function changeMess(choice) {
  const { user } = await api('PATCH', '/api/me/mess', { mess: choice });
  session.user = user;
}

async function saveMess() {
  const choice = $('input[name="mess-choice"]:checked')?.value;
  if (!choice) {
    toast('Pick an option first.', 'bad');
    return;
  }
  await changeMess(choice);
  await refresh();
  toast(choice === 'NONE' ? 'You are not subscribed to any mess.' : `You are now with ${MESSES[choice].name}.`);
}

async function switchToFirstFloor() {
  await changeMess('FF');
  await refresh();
  toast('Switched to First Floor Mess.');
}

async function resetData() {
  const confirmed = await confirmAction({
    title: 'Reset all demo data?',
    message: 'Accounts, payments and entries return to the starting sample data.',
    confirmLabel: 'Reset',
    danger: true,
  });
  if (!confirmed) return;
  await api('POST', '/api/admin/reset');
  ui.kiosk.result = null;
  await refresh();
  toast('Demo data reset.');
}

async function exportTransactions() {
  const rows = db.transactions.map((txn) => [txn.at, txn.description, MESSES[txn.mess].name, txn.method ?? '', txn.amount]);
  downloadCsv(`mess-payments-${session.user.id}.csv`, [['Date', 'Description', 'Mess', 'Method', 'Amount'], ...rows]);
}

async function exportMembers() {
  const { members } = await api('GET', '/api/admin/members?mess=ALL&sort=id&dir=asc');
  const rows = members.map((member) => [
    member.id,
    member.name,
    profileLabel(member),
    assignmentLabel(member),
    member.plan.label,
    member.email,
    member.phone,
    member.createdAt,
    member.lastLoginAt ?? '',
  ]);
  downloadCsv('mess-members.csv', [['ID', 'Name', 'Year', 'Mess', 'Plan status', 'Email', 'Phone', 'Registered', 'Last signed in'], ...rows]);
}

async function exportOrders() {
  const { orders, total } = await api('GET', `/api/admin/orders?${listParams('orders', { page: '1', pageSize: '1000' })}`);
  const rows = orders.map((order) => [
    order.orderNo,
    order.at,
    order.user?.id ?? '',
    order.user?.name ?? '',
    order.user?.email ?? '',
    order.user?.phone ?? '',
    KIND_LABEL[order.kind],
    MESSES[order.mess].name,
    order.description,
    order.items.map((item) => item.label).join('; '),
    METHOD_LABEL[order.method] ?? '',
    order.paymentRef ?? '',
    order.amount,
    order.status,
  ]);
  const header = ['Order no', 'Placed at', 'Student ID', 'Name', 'Email', 'Phone', 'Type', 'Mess', 'Description', 'Items', 'Method', 'Payment ref', 'Amount', 'Status'];
  downloadCsv('mess-orders.csv', [header, ...rows]);
  if (total > orders.length) toast(`Exported the latest ${orders.length} of ${total} orders.`, 'warn');
}

async function exportBookings() {
  const { slots, total } = await api('GET', `/api/admin/bookings?${listParams('bookings', { page: '1', pageSize: '1000' })}`);
  const rows = slots.map((slot) => [
    slot.date,
    MEAL_LABEL[slot.meal],
    slot.type,
    slot.user?.id ?? '',
    slot.user?.name ?? '',
    slot.user?.email ?? '',
    slot.price,
    STATE_LABEL[slot.state],
    slot.createdAt ?? '',
    slot.usedAt ?? '',
    slot.cancelledAt ?? '',
    slot.orderNo,
  ]);
  const header = ['Date', 'Meal', 'Type', 'Student ID', 'Name', 'Email', 'Price', 'Status', 'Placed at', 'Used at', 'Cancelled at', 'Order no'];
  downloadCsv('mess-bookings.csv', [header, ...rows]);
  if (total > slots.length) toast(`Exported the first ${slots.length} of ${total} meals.`, 'warn');
}

let listToken = 0;

async function reloadList(list) {
  const token = ++listToken;
  const data = await (list === 'orders' ? loadOrders() : loadBookings());
  const container = $(`#${list}-results`);
  if (token !== listToken || !container) return;
  routeData = data;
  mount(container, list === 'orders' ? ordersResults(data) : bookingsResults(data));
}

const ACTIONS = {
  'auth-tab': (el) => setAuthTab(el.dataset.tab),
  'fill-demo': (el) => {
    const form = $('#login-form');
    form.elements.id.value = el.dataset.id;
    form.elements.password.value = el.dataset.password;
    return handleLogin(form);
  },
  logout,
  retry: () => route(),
  reload: () => location.reload(),
  'open-clock': openClock,
  'close-dialog': (el) => el.closest('dialog').close(),
  print: () => window.print(),
  'clock-preset': (el) => {
    const base = clock.now();
    const target = el.dataset.monday ? upcomingWeekStart(base) : startOfDay(base);
    target.setHours(Number(el.dataset.hour), Number(el.dataset.minute), 0, 0);
    $('#clock-form').elements.when.value = toLocalInputValue(target);
  },
  'clock-live': () => applyClock(null),
  'ff-tab': (el) => {
    ui.firstFloorTab = el.dataset.tab;
    renderCurrent({ animate: true });
  },
  'toggle-slot': toggleSlot,
  'toggle-day': toggleDay,
  preset: applyPreset,
  'buy-coupons': buyCoupons,
  'book-meals': bookMeals,
  'cancel-booking': cancelBooking,
  'pay-semester': paySemester,
  'save-mess': saveMess,
  'switch-ff': switchToFirstFloor,
  'menu-tab': (el) => {
    ui.menuMess = el.dataset.mess;
    renderCurrent({ animate: true });
  },
  'kiosk-tab': async (el) => {
    ui.kiosk.mess = el.dataset.mess;
    ui.kiosk.result = null;
    await refresh({ animate: true });
  },
  sort: async (el) => {
    const table = ui.members;
    table.sortDir = table.sortKey === el.dataset.key && table.sortDir === 'asc' ? 'desc' : 'asc';
    table.sortKey = el.dataset.key;
    await refresh();
  },
  receipt: (el) => {
    const transaction = db.transactions.find((txn) => txn.id === el.dataset.txn);
    if (transaction) showReceipt(transaction);
  },
  'order-detail': (el) => {
    const source = routeData?.orders ?? routeData?.recentOrders ?? routeData?.transactions ?? [];
    const order = source.find((entry) => entry.id === el.dataset.id);
    if (order) showOrder(order, order.user ?? routeData?.member ?? null);
  },
  page: async (el) => {
    const list = el.dataset.list;
    ui[list].page = Number(el.dataset.page);
    await reloadList(list);
  },
  'clear-filters': async (el) => {
    ui[el.dataset.list] = LIST_DEFAULTS[el.dataset.list]();
    await refresh();
  },
  'export-transactions': exportTransactions,
  'export-members': exportMembers,
  'export-orders': exportOrders,
  'export-bookings': exportBookings,
  'reset-data': resetData,
};

const FORMS = {
  login: handleLogin,
  register: handleRegister,
  pay: handlePay,
  clock: handleClock,
  counter: async (form) => {
    const value = String(new FormData(form).get('id')).trim();
    if (!value) {
      toast('Enter a roll number or employee ID.', 'bad');
      return;
    }
    const { result } = await api('POST', '/api/admin/kiosk/redeem', { id: value });
    ui.kiosk.result = result;
    await refresh();
  },
};

const CHANGES = {
  'kiosk-finger': (el) => {
    ui.kiosk.finger = el.value;
  },
  'member-mess': async (el) => {
    ui.members.mess = el.value;
    await refresh();
  },
  'menu-cell': async (el) => {
    const dishes = el.value.trim();
    if (!dishes) {
      toast('A dish cannot be empty.', 'bad');
      await refresh();
      return;
    }
    await api('PUT', '/api/admin/menu', { mess: el.dataset.mess, day: Number(el.dataset.day), meal: el.dataset.meal, dishes });
    menus[el.dataset.mess][Number(el.dataset.day)][MEALS.indexOf(el.dataset.meal)] = dishes;
    toast('Menu updated.');
  },
};

function reportFailure(error) {
  if (error instanceof ApiError) {
    toast(error.message, 'bad');
    return;
  }
  console.error(error);
  toast('Something went wrong. Please try again.', 'bad');
}

let searchTimer = 0;

function bindEvents() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger || trigger.disabled || trigger.classList.contains('is-busy')) return;
    const handler = ACTIONS[trigger.dataset.action];
    if (!handler) return;
    trigger.classList.add('is-busy');
    Promise.resolve()
      .then(() => handler(trigger, event))
      .catch(reportFailure)
      .finally(() => trigger.classList.remove('is-busy'));
  });

  document.addEventListener('submit', (event) => {
    const key = event.target.dataset.form;
    if (!key) return;
    event.preventDefault();
    Promise.resolve()
      .then(() => FORMS[key](event.target))
      .catch(reportFailure);
  });

  document.addEventListener('change', (event) => {
    const listName = event.target.dataset.list;
    if (listName && event.target.type !== 'text') {
      ui[listName][event.target.dataset.key] = event.target.value;
      ui[listName].page = 1;
      reloadList(listName).catch(reportFailure);
    }
    const key = event.target.dataset.change;
    if (key) {
      Promise.resolve()
        .then(() => CHANGES[key](event.target))
        .catch(reportFailure);
    }
    const form = event.target.form;
    if (form?.dataset.form === 'pay' && event.target.name === 'method') togglePayFields(event.target.value);
    if (form?.dataset.form === 'register' && (event.target.name === 'category' || event.target.name === 'year')) {
      updatePolicyPreview();
      if (event.target.name === 'category') {
        setFieldError(form, 'year', '');
        if (form.elements.id.value) validateRegisterField(form, 'id');
      } else {
        validateRegisterField(form, 'year');
      }
    }
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    const form = target.form;
    if (target.dataset.list && target.type === 'text') {
      const listName = target.dataset.list;
      ui[listName][target.dataset.key] = target.value;
      ui[listName].page = 1;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => reloadList(listName).catch(reportFailure), 250);
      return;
    }
    if (target.dataset.filter === 'query') {
      ui.members.query = target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        try {
          routeData = await loadMembers();
          mount($('#members-body'), memberRows(routeData.members));
        } catch (error) {
          reportFailure(error);
        }
      }, 200);
      return;
    }
    if (form?.dataset.form === 'register') {
      if (target.name === 'password') updateStrength(target.value);
      if (target.getAttribute('aria-invalid') === 'true') validateRegisterField(form, target.name);
      if (target.name === 'phone') target.value = target.value.replace(/\D/g, '');
    }
    if (form?.dataset.form === 'pay') {
      if (target.name === 'card') target.value = target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
      if (target.name === 'expiry') target.value = target.value.replace(/[^\d/]/g, '').replace(/^(\d{2})(\d)/, '$1/$2').slice(0, 5);
      if (target.name === 'cvv') target.value = target.value.replace(/\D/g, '');
      if (target.getAttribute('aria-invalid') === 'true') setFieldError(form, target.name, '');
    }
  });

  document.addEventListener('focusout', (event) => {
    const form = event.target.form;
    if (form?.dataset.form === 'register' && event.target.name) validateRegisterField(form, event.target.name);
  });

  document.addEventListener('pointerdown', (event) => {
    const element = event.target.closest('[data-pad]');
    if (!element) return;
    event.preventDefault();
    beginHold(element);
  });
  document.addEventListener('pointerup', endHold);
  document.addEventListener('pointercancel', endHold);
  document.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat && event.target.matches?.('[data-pad]')) {
      event.preventDefault();
      beginHold(event.target);
    }
  });
  document.addEventListener('keyup', (event) => {
    if (event.key === ' ' || event.key === 'Enter') endHold();
  });

  let tiltCard = null;
  const resetTilt = () => {
    if (!tiltCard) return;
    if (motionOn()) gsap.to(tiltCard, { rotationX: 0, rotationY: 0, duration: 0.7, ease: 'expo.out', overwrite: 'auto' });
    tiltCard = null;
  };
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const card = event.target.closest?.('.mess-card:not(.mess-card--empty)');
    if (!card) {
      resetTilt();
      return;
    }
    if (tiltCard && tiltCard !== card) resetTilt();
    tiltCard = card;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    if (motionOn()) gsap.to(card, { rotationY: (x - 0.5) * 12, rotationX: (0.5 - y) * 9, transformPerspective: 900, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
  });

  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
  $('#pay-dialog').addEventListener('close', () => {
    if (!paymentFlow) return;
    paymentFlow.resolve(null);
    paymentFlow = null;
  });

  window.addEventListener('hashchange', () => route().catch(reportFailure));
  window.addEventListener('resize', () => {
    updateTimelines(clock.now());
    positionNavBar();
  });
}

async function boot() {
  bindEvents();
  updateStrength('');
  try {
    applyConfig(await api('GET', '/api/config', undefined, { quiet: true }));
  } catch (error) {
    hideBoot();
    $('#view-app').hidden = false;
    mount($('#view-app'), html`
      <div class="empty" style="margin-top:80px">
        <span class="empty-icon">${raw(EMPTY_ICON)}</span>
        <strong>The mess server is not reachable</strong>
        <span class="muted">${error.message} Start it with npm start and reload.</span>
        <button type="button" class="btn btn--primary btn--sm" data-action="reload">Reload</button>
      </div>`);
    return;
  }

  try {
    const { user } = await api('GET', '/api/me', undefined, { quiet: true });
    session.user = user;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }

  $('#demo-logins').hidden = !CONFIG.demoData;
  if (!CONFIG.demoClock && demo.offsetMs !== 0) {
    demo.offsetMs = 0;
    saveDemoOffset();
  }

  updatePolicyPreview();
  tick();
  setInterval(tick, 1000);
  await route();
}

boot().catch((error) => {
  console.error(error);
  hideBoot();
  toast('The app could not start. Check the server and reload.', 'bad');
});
