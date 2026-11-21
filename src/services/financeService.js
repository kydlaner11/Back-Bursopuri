const { Prisma } = require('@prisma/client');
const prisma = require('../../database/connection');
const { createError } = require('../helpers/errorHelpers');

const D = (v) => new Prisma.Decimal(v);
const ZERO = D(0);

const notFound = (message) => createError({ status: 404, message });
const conflict = (message) => createError({ status: 409, message });
const badRequest = (message) => createError({ status: 400, message });

// Semua perhitungan uang dilakukan di sini (backend), bukan di frontend.
const calcFee = (gross, rate) =>
  D(gross).mul(D(rate)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

const dayKey = (d) => d.toISOString().slice(0, 10);

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

// Bentuk plain-JSON untuk audit (Decimal -> string, Date -> ISO)
const snapshot = (obj) => JSON.parse(JSON.stringify(obj));

const withNet = (sale) => ({
  ...sale,
  netReceivable: D(sale.grossSales).sub(D(sale.platformFee)).toString(),
});

// ---------------------------------------------------------------- CHANNELS
const listChannels = () =>
  prisma.finChannel.findMany({ orderBy: [{ isOnline: 'asc' }, { name: 'asc' }] });

const updateChannel = async (id, input, userId) => {
  return prisma.$transaction(async (tx) => {
    const before = await tx.finChannel.findUnique({ where: { id } });
    if (!before) throw notFound('Kanal tidak ditemukan');

    const after = await tx.finChannel.update({ where: { id }, data: input });
    await audit(tx, {
      userId,
      action: 'UPDATE',
      entity: 'FinChannel',
      entityId: id,
      before: snapshot(before),
      after: snapshot(after),
    });
    return after;
  });
};

// ---------------------------------------------------------------- ACCOUNTS
// Saldo = saldo awal + pemasukan + transfer masuk - pengeluaran - transfer keluar
// (transaksi void tidak dihitung). Catatan: penjualan harian BELUM masuk saldo
// akun; alurnya (pencairan platform / setoran kas) dibuat di tahap berikutnya.
const listAccounts = async () => {
  const [accounts, grouped] = await Promise.all([
    prisma.finAccount.findMany({ orderBy: [{ wallet: 'asc' }, { name: 'asc' }] }),
    prisma.finTransaction.groupBy({
      by: ['accountId', 'type'],
      where: { isVoided: false },
      _sum: { amount: true },
    }),
  ]);

  const sums = {};
  for (const g of grouped) {
    sums[g.accountId] = sums[g.accountId] || {};
    sums[g.accountId][g.type] = g._sum.amount || ZERO;
  }

  return accounts.map((a) => {
    const s = sums[a.id] || {};
    const balance = D(a.openingBalance)
      .add(s.INCOME || ZERO)
      .add(s.TRANSFER_IN || ZERO)
      .sub(s.EXPENSE || ZERO)
      .sub(s.TRANSFER_OUT || ZERO);
    return { ...a, balance: balance.toString() };
  });
};

const createAccount = async (input, userId) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const account = await tx.finAccount.create({ data: input });
      await audit(tx, {
        userId,
        action: 'CREATE',
        entity: 'FinAccount',
        entityId: account.id,
        after: snapshot(account),
      });
      return account;
    });
  } catch (e) {
    if (e.code === 'P2002') throw conflict('Nama akun sudah dipakai pada dompet ini');
    throw e;
  }
};

// ------------------------------------------------------------------- SALES
const createSale = async (input, userId) => {
  const channel = await prisma.finChannel.findUnique({ where: { code: input.channel } });
  if (!channel) throw badRequest(`Kanal ${input.channel} tidak dikenal`);
  if (!channel.isActive) throw badRequest(`Kanal ${channel.name} tidak aktif`);

  const rate = channel.commissionRate;
  const data = {
    grossSales: input.grossSales,
    commissionRate: rate,
    platformFee: calcFee(input.grossSales, rate),
    orderCount: input.orderCount,
    notes: input.notes ?? null,
  };

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.finDailySale.findUnique({
        where: { salesDate_channelId: { salesDate: input.salesDate, channelId: channel.id } },
      });

      if (existing && !existing.isVoided) {
        throw conflict(
          `Rekap ${channel.name} tanggal ${dayKey(input.salesDate)} sudah ada. Gunakan edit, bukan input baru.`
        );
      }

      let sale;
      if (existing) {
        // Rekap yang pernah di-void dihidupkan kembali (unique constraint melarang baris baru)
        sale = await tx.finDailySale.update({
          where: { id: existing.id },
          data: { ...data, isVoided: false, createdById: userId },
          include: { channel: true },
        });
        await audit(tx, {
          userId, action: 'UPDATE', entity: 'FinDailySale', entityId: sale.id,
          before: snapshot(existing), after: snapshot(sale),
        });
      } else {
        sale = await tx.finDailySale.create({
          data: { ...data, salesDate: input.salesDate, channelId: channel.id, createdById: userId },
          include: { channel: true },
        });
        await audit(tx, {
          userId, action: 'CREATE', entity: 'FinDailySale', entityId: sale.id,
          after: snapshot(sale),
        });
      }
      return withNet(sale);
    });
  } catch (e) {
    // Dua request bersamaan untuk tanggal+kanal yang sama
    if (e.code === 'P2002') throw conflict('Rekap untuk tanggal dan kanal ini sudah ada');
    throw e;
  }
};

const listSales = async ({ startDate, endDate }) => {
  const sales = await prisma.finDailySale.findMany({
    where: { isVoided: false, salesDate: { gte: startDate, lte: endDate } },
    include: { channel: { select: { code: true, name: true } } },
    orderBy: [{ salesDate: 'desc' }, { channel: { name: 'asc' } }],
  });
  return sales.map(withNet);
};

const updateSale = async (id, input, userId) => {
  return prisma.$transaction(async (tx) => {
    const before = await tx.finDailySale.findUnique({ where: { id } });
    if (!before || before.isVoided) throw notFound('Rekap penjualan tidak ditemukan');

    const gross = input.grossSales ?? before.grossSales;
    const data = {
      grossSales: gross,
      // komisi memakai snapshot saat rekap dibuat, bukan tarif kanal terbaru
      platformFee: calcFee(gross, before.commissionRate),
    };
    if (input.orderCount !== undefined) data.orderCount = input.orderCount;
    if (input.notes !== undefined) data.notes = input.notes;

    const after = await tx.finDailySale.update({
      where: { id },
      data,
      include: { channel: true },
    });
    await audit(tx, {
      userId, action: 'UPDATE', entity: 'FinDailySale', entityId: id,
      before: snapshot(before), after: snapshot(after),
    });
    return withNet(after);
  });
};

const voidSale = async (id, { reason }, userId) => {
  return prisma.$transaction(async (tx) => {
    const before = await tx.finDailySale.findUnique({ where: { id } });
    if (!before || before.isVoided) throw notFound('Rekap penjualan tidak ditemukan');

    const after = await tx.finDailySale.update({ where: { id }, data: { isVoided: true } });
    await audit(tx, {
      userId, action: 'VOID', entity: 'FinDailySale', entityId: id,
      before: snapshot(before), after: snapshot({ ...after, voidReason: reason }),
    });
    return { id, voided: true };
  });
};

const salesSummary = async ({ startDate, endDate }) => {
  const sales = await prisma.finDailySale.findMany({
    where: { isVoided: false, salesDate: { gte: startDate, lte: endDate } },
    include: { channel: { select: { code: true, name: true } } },
    orderBy: { salesDate: 'asc' },
  });

  const blank = () => ({ gross: ZERO, fee: ZERO, orders: 0 });
  const total = blank();
  const byChannel = {};
  const byDay = {};

  for (const s of sales) {
    const bucket = (map, key, extra = {}) => (map[key] = map[key] || { ...blank(), ...extra });
    const c = bucket(byChannel, s.channel.code, { name: s.channel.name });
    const d = bucket(byDay, dayKey(s.salesDate));
    for (const b of [total, c, d]) {
      b.gross = b.gross.add(s.grossSales);
      b.fee = b.fee.add(s.platformFee);
      b.orders += s.orderCount;
    }
  }

  const out = (b) => ({
    grossSales: b.gross.toString(),
    platformFee: b.fee.toString(),
    netReceivable: b.gross.sub(b.fee).toString(),
    orderCount: b.orders,
    averageOrderValue: b.orders > 0 ? b.gross.div(b.orders).toDecimalPlaces(0).toString() : null,
  });

  const days = Object.keys(byDay).length;
  return {
    period: { startDate: dayKey(startDate), endDate: dayKey(endDate) },
    daysWithData: days,
    total: out(total),
    averageGrossPerDay: days > 0 ? total.gross.div(days).toDecimalPlaces(0).toString() : null,
    byChannel: Object.entries(byChannel).map(([code, b]) => ({ code, name: b.name, ...out(b) })),
    trend: Object.entries(byDay).map(([date, b]) => ({ date, ...out(b) })),
  };
};

module.exports = {
  listChannels, updateChannel,
  listAccounts, createAccount,
  createSale, listSales, updateSale, voidSale, salesSummary,
};