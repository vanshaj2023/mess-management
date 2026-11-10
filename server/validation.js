const { z } = require('zod');
const { ApiError } = require('./errors');
const { isValidKey } = require('./time');

const NAME_MESSAGE = 'Use 3 to 60 letters, spaces or dots.';
const PASSWORD_MESSAGE = 'At least 8 characters with a letter and a digit.';
const YEAR_MESSAGE = 'Select your year of study.';
const STUDENT_ID_PATTERN = /^[A-Z]\d{6}$/;
const STAFF_ID_PATTERN = /^E\d{4}$/;

function issuesToFields(issues) {
  const fields = {};
  for (const issue of issues) {
    const [first, second] = issue.path;
    const key = String(first === 'payment' && second !== undefined ? second : first ?? 'body');
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw new ApiError(400, 'Please fix the highlighted fields.', 'VALIDATION', issuesToFields(result.error.issues));
}

const text = (message) => z.string({ error: message });

const registerSchema = z
  .object({
    category: z.enum(['student', 'staff'], { error: 'Choose student or staff.' }),
    name: text(NAME_MESSAGE).trim().regex(/^[A-Za-z][A-Za-z .'-]{2,59}$/, NAME_MESSAGE),
    id: text('Enter your ID.').trim().toUpperCase(),
    year: z.preprocess(
      (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
      z.number({ error: YEAR_MESSAGE }).int(YEAR_MESSAGE).min(1, YEAR_MESSAGE).max(4, YEAR_MESSAGE).optional(),
    ),
    email: text('Use your @iiit-bh.ac.in address.')
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]+@iiit-bh\.ac\.in$/, 'Use your @iiit-bh.ac.in address.'),
    phone: text('Enter a 10 digit mobile number.').trim().regex(/^[6-9]\d{9}$/, 'Enter a 10 digit mobile number.'),
    password: text(PASSWORD_MESSAGE)
      .max(200, PASSWORD_MESSAGE)
      .refine((value) => value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value), PASSWORD_MESSAGE),
  })
  .superRefine((data, ctx) => {
    if (data.category === 'staff') {
      if (!STAFF_ID_PATTERN.test(data.id)) ctx.addIssue({ code: 'custom', path: ['id'], message: 'Employee ID looks like E1042.' });
      return;
    }
    if (!STUDENT_ID_PATTERN.test(data.id)) ctx.addIssue({ code: 'custom', path: ['id'], message: 'Roll number looks like B526001.' });
    if (data.year === undefined) ctx.addIssue({ code: 'custom', path: ['year'], message: YEAR_MESSAGE });
  });

const loginSchema = z.object({
  id: text('Enter your ID.').trim().min(1, 'Enter your ID.').max(20, 'Enter your ID.').toUpperCase(),
  password: text('Enter your password.').min(1, 'Enter your password.').max(200, 'Enter your password.'),
});

const paymentSchema = z
  .object({
    method: z.enum(['upi', 'card'], { error: 'Choose UPI or card.' }),
    upi: z.string().max(100).optional(),
    card: z.string().max(30).optional(),
    expiry: z.string().max(10).optional(),
    cvv: z.string().max(5).optional(),
  })
  .superRefine((payment, ctx) => {
    if (payment.method === 'upi') {
      if (!/^[\w.-]{2,}@[a-z]{2,}$/i.test((payment.upi ?? '').trim())) {
        ctx.addIssue({ code: 'custom', path: ['upi'], message: 'Enter a valid UPI ID like name@bank.' });
      }
      return;
    }
    if (!/^\d{16}$/.test((payment.card ?? '').replace(/\s/g, ''))) {
      ctx.addIssue({ code: 'custom', path: ['card'], message: 'Enter the 16 digit card number.' });
    }
    const expiry = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec((payment.expiry ?? '').trim());
    if (!expiry) {
      ctx.addIssue({ code: 'custom', path: ['expiry'], message: 'Use MM/YY.' });
    } else if (new Date(2000 + Number(expiry[2]), Number(expiry[1]), 1) <= new Date()) {
      ctx.addIssue({ code: 'custom', path: ['expiry'], message: 'This card has expired.' });
    }
    if (!/^\d{3}$/.test(payment.cvv ?? '')) {
      ctx.addIssue({ code: 'custom', path: ['cvv'], message: 'Enter the 3 digit CVV.' });
    }
  });

const slotSchema = z.object({
  date: z.string({ error: 'Pick valid meals.' }).refine(isValidKey, 'Pick valid meals.'),
  meal: z.enum(['breakfast', 'lunch', 'dinner'], { error: 'Pick valid meals.' }),
});

const slotsSchema = (max) =>
  z.array(slotSchema, { error: 'Pick valid meals.' }).max(max, `You can pick up to ${max} meals at a time.`);

const couponPurchaseSchema = z.object({ slots: slotsSchema(21), payment: paymentSchema });
const bookingSchema = z.object({ slots: slotsSchema(14), payment: paymentSchema });
const paymentOnlySchema = z.object({ payment: paymentSchema });

const messSchema = z.object({ mess: z.enum(['GF', 'PB', 'FF', 'NONE'], { error: 'Pick a valid mess.' }) });

const membersQuerySchema = z.object({
  q: z.string().max(60).optional().default(''),
  mess: z.enum(['ALL', 'GF', 'PB', 'FF', 'NONE']).optional().default('ALL'),
  sort: z.enum(['id', 'name', 'type', 'mess', 'plan']).optional().default('id'),
  dir: z.enum(['asc', 'desc']).optional().default('asc'),
});

const optionalDate = z.union([z.literal(''), z.string().refine(isValidKey, 'Pick a valid date.')]).optional().default('');
const pagination = {
  page: z.coerce.number().int().min(1).max(100000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).optional().default(25),
};

const ordersQuerySchema = z.object({
  q: z.string().max(60).optional().default(''),
  kind: z.enum(['ALL', 'semester', 'coupons', 'booking']).optional().default('ALL'),
  mess: z.enum(['ALL', 'GF', 'PB', 'FF']).optional().default('ALL'),
  method: z.enum(['ALL', 'upi', 'card']).optional().default('ALL'),
  type: z.enum(['ALL', 'payment', 'refund']).optional().default('ALL'),
  from: optionalDate,
  to: optionalDate,
  ...pagination,
});

const slotsQuerySchema = z.object({
  q: z.string().max(60).optional().default(''),
  type: z.enum(['ALL', 'coupon', 'booking']).optional().default('ALL'),
  state: z.enum(['ALL', 'upcoming', 'used', 'missed', 'cancelled']).optional().default('ALL'),
  meal: z.enum(['ALL', 'breakfast', 'lunch', 'dinner']).optional().default('ALL'),
  from: optionalDate,
  to: optionalDate,
  ...pagination,
});

const memberIdSchema = z.object({ id: z.string().trim().min(1).max(20) });

const kioskScanSchema = z.object({
  mess: z.enum(['GF', 'PB'], { error: 'Pick Ground Floor or P Block.' }),
  fingerId: z.string({ error: 'Missing finger.' }).trim().max(20),
});

const redeemSchema = z.object({ id: z.string({ error: 'Enter an ID.' }).trim().min(1, 'Enter an ID.').max(20, 'Enter an ID.') });
const recentQuerySchema = z.object({ mess: z.enum(['GF', 'PB', 'FF'], { error: 'Pick a mess.' }) });

const menuEditSchema = z.object({
  mess: z.enum(['GF', 'PB', 'FF']),
  day: z.number().int().min(0).max(6),
  meal: z.enum(['breakfast', 'lunch', 'dinner']),
  dishes: z.string().trim().min(1, 'Enter at least one dish.').max(120, 'Keep it under 120 characters.'),
});

const uniqueSlots = (slots) => {
  const seen = new Set();
  return slots.filter((slot) => {
    const key = `${slot.date}|${slot.meal}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

module.exports = {
  parse,
  registerSchema,
  loginSchema,
  couponPurchaseSchema,
  bookingSchema,
  paymentOnlySchema,
  messSchema,
  membersQuerySchema,
  ordersQuerySchema,
  slotsQuerySchema,
  memberIdSchema,
  kioskScanSchema,
  redeemSchema,
  recentQuerySchema,
  menuEditSchema,
  uniqueSlots,
};
