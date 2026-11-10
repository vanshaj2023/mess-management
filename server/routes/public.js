const express = require('express');
const { env, rules, MEALS } = require('../config');
const { col } = require('../db');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ ok: true });
});

router.get('/config', (req, res) => {
  res.json({
    semesterFee: rules.semesterFee,
    weeklyMinimum: rules.weeklyMinimum,
    couponPrice: rules.couponPrice,
    booking: rules.booking,
    mealWindow: rules.mealWindow,
    demoClock: env.allowDemoClock,
    demoData: env.seedDemoData,
  });
});

router.get('/menus', async (req, res) => {
  const rows = await col('menus').find({}).toArray();
  const menus = {};
  for (const mess of ['GF', 'PB', 'FF']) {
    menus[mess] = Array.from({ length: 7 }, (_, day) =>
      MEALS.map((meal) => rows.find((row) => row.mess === mess && row.day === day && row.meal === meal)?.dishes ?? ''),
    );
  }
  res.json(menus);
});

module.exports = router;
