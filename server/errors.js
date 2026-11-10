const STATUS_BY_CODE = {
  NOT_FF: 409,
  NO_SLOTS: 400,
  OUTSIDE_SALE_WEEK: 400,
  DUPLICATE: 409,
  MEAL_PASSED: 409,
  BELOW_MINIMUM: 400,
  NOT_BOOKABLE: 400,
  PAST_DATE: 400,
  CUTOFF_PASSED: 409,
  COUPON_EXISTS: 409,
  ALREADY_BOOKED: 409,
  NOT_ALLOWED: 400,
  PLAN_LOCKED: 409,
  NOT_SEMESTER_MESS: 400,
  ALREADY_PAID: 409,
  NOT_SUBSCRIBED: 409,
  NOT_CANCELLABLE: 409,
  NOT_FOUND: 404,
  ID_TAKEN: 409,
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
};

class ApiError extends Error {
  constructor(status, message, code, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const problem = (code, message, fields) => new ApiError(STATUS_BY_CODE[code] ?? 400, message, code, fields);
const isDuplicateKey = (error) => error?.code === 11000;

module.exports = { ApiError, problem, isDuplicateKey };
