const { env } = require('./config');
const { connect, ensureIndexes, close, col } = require('./db');
const { resetDemoData } = require('./seed');

async function main() {
  if (!env.seedDemoData) throw new Error('SEED_DEMO_DATA is false. Seeding wipes every collection, so it is blocked.');
  await connect();
  await ensureIndexes();
  await resetDemoData();
  const [users, coupons, scans] = await Promise.all([
    col('users').countDocuments(),
    col('coupons').countDocuments(),
    col('scans').countDocuments(),
  ]);
  console.log(`Seeded database "${env.mongoDb}": ${users} users, ${coupons} coupons, ${scans} scans.`);
  console.log('Demo logins: members use demo123, ADMIN uses admin123.');
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(close);
