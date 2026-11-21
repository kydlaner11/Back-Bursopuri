const { Prisma } = require('@prisma/client');
const { createError } = require('../src/helpers/errorHelpers');

const D = (v) => new Prisma.Decimal(v);
const ZERO = D(0);

const notFound = (message) => createError({ status: 404, message });
const conflict = (message) => createError({ status: 409, message });
const badRequest = (message) => createError({ status: 400, message });

const dayKey = (d) => d.toISOString().slice(0, 10);

// Tanggal bisnis hari ini di WIB (UTC+7), sebagai Date UTC midnight
const todayWIB = () => {
  const s = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  return new Date(`${s}T00:00:00.000Z`);
};
const monthStartWIB = () => {
  const t = todayWIB();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
};

const snapshot = (obj) => JSON.parse(JSON.stringify(obj));

const audit = (tx, { userId, action, entity, entityId, before, after }) =>
  tx.finAuditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      beforeData: before ?? undefined,
      afterData: after ?? undefined,
    },
  });

// Saldo satu akun: saldo awal + pemasukan + transfer masuk - pengeluaran - transfer keluar
const accountBalance = async (db, accountId) => {
  const account = await db.finAccount.findUnique({ where: { id: accountId } });
  const groups = await db.finTransaction.groupBy({
    by: ['type'],
    where: { accountId, isVoided: false },
    _sum: { amount: true },
  });
  const s = {};
  for (const g of groups) s[g.type] = g._sum.amount || ZERO;
  return D(account.openingBalance)
    .add(s.INCOME || ZERO)
    .add(s.TRANSFER_IN || ZERO)
    .sub(s.EXPENSE || ZERO)
    .sub(s.TRANSFER_OUT || ZERO);
};

// Bungkus handler express: tangkap error -> next()
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  D, ZERO, notFound, conflict, badRequest, dayKey,
  todayWIB, monthStartWIB, snapshot, audit, accountBalance, wrap,
};