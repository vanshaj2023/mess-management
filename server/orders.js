const crypto = require('node:crypto');
const time = require('./time');

function orderNumber(isoStamp) {
  const day = time.dateKeyOf(Date.parse(isoStamp)).replaceAll('-', '');
  return `ORD-${day}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function paymentRefOf(payment) {
  if (payment.method === 'upi') return payment.upi.trim().toLowerCase();
  return `Card ending ${payment.card.replace(/\s/g, '').slice(-4)}`;
}

module.exports = { orderNumber, paymentRefOf };
