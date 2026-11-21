const { Prisma } = require('@prisma/client');
const prisma = require('../../database/connection');
const { D, ZERO, dayKey, todayWIB, monthStartWIB } = require('../../utils/financeUtils');
const { salesSummary, listAccounts } = require('./financeService');
const { listObligations } = require('./obligationService');

const sumBy = (items, keyFn) => {
  const map = new Map();
  for (const it of items) {
    const key = keyFn(it);
    map.set(key, (map.get(key) || ZERO).add(it.amount));
  }
  return map;
};

const expenseBlock = (items) => {
  const total = items.reduce((a, t) => a.add(t.amount), ZERO);
  const byCategory = [...sumBy(items, (t) => t.category?.name || 'Tanpa kategori').entries()]
    .map(([name, amt]) => ({ name, total: amt.toString(), _n: amt }))
    .sort((a, b) => b._n.cmp(a._n))
    .map(({ _n, ...rest }) => rest);
  return { total: total.toString(), byCategory };
};

const getDashboard = async (q) => {
  const today = todayWIB();
  const startDate = q.startDate ?? monthStartWIB();
  const endDate = q.endDate ?? today;
  const days = q.days ?? 30;

  const [sales, todaySales, accounts, expenses, ownerPay, obligations] = await Promise.all([
    salesSummary({ startDate, endDate }),
    salesSummary({ startDate: today, endDate: today }),
    listAccounts(),
    prisma.finTransaction.findMany({
      where: { type: 'EXPENSE', isVoided: false, transactionDate: { gte: startDate, lte: endDate } },
      select: { amount: true, category: { select: { name: true } }, account: { select: { wallet: true } } },
    }),
    prisma.finTransaction.aggregate({
      where: {
        type: 'TRANSFER_OUT', reference: 'OWNER_PAY', isVoided: false,
        transactionDate: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    }),
    listObligations({ days }),
  ]);

  const business = expenseBlock(expenses.filter((t) => t.account.wallet === 'BUSINESS'));
  const family = expenseBlock(expenses.filter((t) => t.account.wallet === 'FAMILY'));
  const ownerPayTotal = ownerPay._sum.amount || ZERO;

  // Hasil usaha (kas) = penjualan bersih setelah komisi - pengeluaran usaha.
  // BUKAN laba: belum memperhitungkan HPP/stok, jadi dipisah dari grossProfit/netProfit.
  const net = D(sales.total.netReceivable);
  const operatingResult = net.sub(D(business.total));

  const walletBalance = (w) =>
    accounts.filter((a) => a.wallet === w && a.isActive)
      .reduce((acc, a) => acc.add(a.balance), ZERO).toString();

  // Target harian: butuh asumsi margin. Tanpa itu, kita tidak mengarang angka.
  let dailyTarget = null;
  if (q.marginRate) {
    const required = D(obligations.totals.all.dailyReserve);
    const breakEven = required.div(q.marginRate).toDecimalPlaces(0, Prisma.Decimal.ROUND_UP);
    const todayGross = D(todaySales.total.grossSales);
    const progress = breakEven.gt(0)
      ? todayGross.div(breakEven).mul(100).toDecimalPlaces(0)
      : D(0);
    dailyTarget = {
      assumedMarginRate: q.marginRate,
      requiredProfitPerDay: required.toString(),
      breakEvenRevenuePerDay: breakEven.toString(),
      todayDate: dayKey(today),
      todayGrossSales: todayGross.toString(),
      progressPercent: progress.toString(),
      status: todayGross.gte(breakEven) ? 'AMAN' : 'BELUM',
      note: 'Margin adalah asumsi (setelah HPP, komisi, kemasan). Akan akurat setelah HPP menu terisi.',
    };
  }

  return {
    period: { startDate: dayKey(startDate), endDate: dayKey(endDate) },
    sales,
    expenses: { business, family },
    ownerPay: ownerPayTotal.toString(),
    operatingResult: {
      value: operatingResult.toString(),
      afterOwnerPay: operatingResult.sub(ownerPayTotal).toString(),
      note: 'Penjualan bersih (setelah komisi) dikurangi pengeluaran usaha. Bukan laba.',
    },
    balances: { business: walletBalance('BUSINESS'), family: walletBalance('FAMILY') },
    obligations: obligations.totals,
    dailyTarget,
    // sengaja null sampai HPP menu tersedia, supaya tidak ada angka laba palsu
    grossProfit: null,
    netProfit: null,
  };
};

module.exports = { getDashboard };