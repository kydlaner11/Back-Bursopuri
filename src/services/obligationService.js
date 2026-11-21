const { Prisma } = require('@prisma/client');
const prisma = require('../../database/connection');
const {
  D, ZERO, notFound, conflict, todayWIB, snapshot, audit,
} = require('../../utils/financeUtils');

// Setoran harian dibulatkan KE ATAS supaya uang yang disisihkan tidak kurang.
const dailyReserve = (monthly, days) =>
  D(monthly).div(days).toDecimalPlaces(0, Prisma.Decimal.ROUND_UP);

const listObligations = async ({ days = 30 } = {}) => {
  const rows = await prisma.finObligation.findMany({
    orderBy: [{ wallet: 'asc' }, { monthlyAmount: 'desc' }],
  });
  const today = todayWIB();

  const items = rows.map((o) => {
    const isEnded = !!o.endDate && o.endDate < today;
    const counted = o.isActive && !isEnded;
    return {
      ...o,
      isEnded,
      counted,
      dailyReserve: counted ? dailyReserve(o.monthlyAmount, days).toString() : '0',
    };
  });

  const sum = (pred) =>
    items.filter(pred).reduce((acc, o) => acc.add(o.monthlyAmount), ZERO);
  const totals = (pred) => {
    const monthly = sum(pred);
    return { monthly: monthly.toString(), dailyReserve: dailyReserve(monthly, days).toString() };
  };

  return {
    days,
    totals: {
      all: totals((o) => o.counted),
      business: totals((o) => o.counted && o.wallet === 'BUSINESS'),
      family: totals((o) => o.counted && o.wallet === 'FAMILY'),
    },
    items,
  };
};

const createObligation = async (input, userId) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.finObligation.create({ data: input });
      await audit(tx, {
        userId, action: 'CREATE', entity: 'FinObligation', entityId: created.id,
        after: snapshot(created),
      });
      return created;
    });
  } catch (e) {
    if (e.code === 'P2002') throw conflict('Kewajiban dengan nama ini sudah ada pada dompet ini');
    throw e;
  }
};

const updateObligation = async (id, input, userId) =>
  prisma.$transaction(async (tx) => {
    const before = await tx.finObligation.findUnique({ where: { id } });
    if (!before) throw notFound('Kewajiban tidak ditemukan');
    const after = await tx.finObligation.update({ where: { id }, data: input });
    await audit(tx, {
      userId, action: 'UPDATE', entity: 'FinObligation', entityId: id,
      before: snapshot(before), after: snapshot(after),
    });
    return after;
  });

module.exports = { listObligations, createObligation, updateObligation };