const prisma = require('../../database/connection');
const {
  D, ZERO, notFound, conflict, badRequest, dayKey, snapshot, audit,
} = require('../../utils/financeUtils');
const { computeSale } = require('../../utils/salesMath');

const CHANNEL_SELECT = { code: true, name: true, isOnline: true, commissionRate: true };
const BRAND_SELECT = { code: true, name: true };
const SALE_INCLUDE = {
  channel: { select: CHANNEL_SELECT },
  brand: { select: BRAND_SELECT },
};

// Filter penjualan: periode + (opsional) satu brand. Tanpa brand = semua brand digabung.
const salesWhere = ({ startDate, endDate, brand }) => ({
  isVoided: false,
  salesDate: { gte: startDate, lte: endDate },
  ...(brand ? { brand: { code: brand } } : {}),
});

// ------------------------------------------------------------------ BRANDS
const listBrands = () =>
  prisma.finBrand.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

// netReceivable = alias lama dari netReceived (dipertahankan agar klien lama tidak patah)
const shapeSale = (sale) => ({ ...sale, netReceivable: sale.netReceived });

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
// Basis input: UANG DITERIMA (netReceived). Omzet kotor & komisi diturunkan oleh
// computeSale (lihat salesMath.js) dan ditandai isGrossEstimated bila hanya perkiraan.
const createSale = async (input, userId) => {
  const channel = await prisma.finChannel.findUnique({ where: { code: input.channel } });
  if (!channel) throw badRequest(`Kanal ${input.channel} tidak dikenal`);
  if (!channel.isActive) throw badRequest(`Kanal ${channel.name} tidak aktif`);

  const brand = await prisma.finBrand.findUnique({ where: { code: input.brand } });
  if (!brand) throw badRequest(`Brand ${input.brand} tidak dikenal`);
  if (!brand.isActive) throw badRequest(`Brand ${brand.name} tidak aktif`);

  const calc = computeSale({
    net: input.netReceived,
    gross: input.grossSales,
    rateOverride: input.commissionRate,
    channel,
  });
  const data = { ...calc, brandId: brand.id, orderCount: input.orderCount, notes: input.notes ?? null };

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.finDailySale.findUnique({
        where: {
          salesDate_channelId_brandId: {
            salesDate: input.salesDate,
            channelId: channel.id,
            brandId: brand.id,
          },
        },
      });

      if (existing && !existing.isVoided) {
        throw conflict(
          `Rekap ${brand.name} / ${channel.name} tanggal ${dayKey(input.salesDate)} sudah ada. Gunakan edit, bukan input baru.`
        );
      }

      let sale;
      if (existing) {
        // Rekap yang pernah di-void dihidupkan kembali (unique constraint melarang baris baru)
        sale = await tx.finDailySale.update({
          where: { id: existing.id },
          data: { ...data, isVoided: false, createdById: userId },
          include: SALE_INCLUDE,
        });
        await audit(tx, {
          userId, action: 'UPDATE', entity: 'FinDailySale', entityId: sale.id,
          before: snapshot(existing), after: snapshot(sale),
        });
      } else {
        sale = await tx.finDailySale.create({
          data: { ...data, salesDate: input.salesDate, channelId: channel.id, createdById: userId },
          include: SALE_INCLUDE,
        });
        await audit(tx, {
          userId, action: 'CREATE', entity: 'FinDailySale', entityId: sale.id,
          after: snapshot(sale),
        });
      }
      return shapeSale(sale);
    });
  } catch (e) {
    // Dua request bersamaan untuk tanggal+kanal yang sama
    if (e.code === 'P2002') throw conflict('Rekap untuk tanggal, brand, dan kanal ini sudah ada');
    throw e;
  }
};

const listSales = async ({ startDate, endDate, brand }) => {
  const sales = await prisma.finDailySale.findMany({
    where: salesWhere({ startDate, endDate, brand }),
    include: SALE_INCLUDE,
    orderBy: [{ salesDate: 'desc' }, { brand: { sortOrder: 'asc' } }, { channel: { name: 'asc' } }],
  });
  return sales.map(shapeSale);
};

// Update = tentukan ulang masukan hitungan:
//  - netReceived  : diganti jika dikirim, selain itu tetap
//  - grossSales   : angka -> pakai omzet kotor nyata; null -> kembali ke estimasi;
//                   tidak dikirim -> tetap seperti sebelumnya
//  - commissionRate: angka -> estimasi dengan komisi itu; null -> komisi default kanal;
//                   tidak dikirim -> tetap seperti sebelumnya (bila sebelumnya estimasi)
const updateSale = async (id, input, userId) => {
  return prisma.$transaction(async (tx) => {
    const before = await tx.finDailySale.findUnique({
      where: { id },
      include: SALE_INCLUDE,
    });
    if (!before || before.isVoided) throw notFound('Rekap penjualan tidak ditemukan');

    const net = input.netReceived ?? before.netReceived;

    let gross =
      input.grossSales !== undefined
        ? input.grossSales
        : before.isGrossEstimated ? null : before.grossSales;

    let rateOverride = input.commissionRate !== undefined ? input.commissionRate : null;

    // Pengguna memberi komisi tanpa menyebut omzet kotor -> beralih ke mode estimasi
    if (input.commissionRate != null && input.grossSales === undefined) gross = null;
    // Komisi tidak disebut sama sekali & sebelumnya estimasi -> pertahankan komisi yang dipakai
    if (gross === null && input.commissionRate === undefined && before.isGrossEstimated) {
      rateOverride = before.commissionRate;
    }

    const calc = computeSale({ net, gross, rateOverride, channel: before.channel });
    const data = { ...calc };
    if (input.orderCount !== undefined) data.orderCount = input.orderCount;
    if (input.notes !== undefined) data.notes = input.notes;

    const after = await tx.finDailySale.update({
      where: { id },
      data,
      include: SALE_INCLUDE,
    });
    await audit(tx, {
      userId, action: 'UPDATE', entity: 'FinDailySale', entityId: id,
      before: snapshot(before), after: snapshot(after),
    });
    return shapeSale(after);
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

// Ringkasan. Yang PASTI: netReceived (uang diterima). Yang ESTIMASI bila grossEstimated=true:
// grossSales, platformFee, averageOrderValue. observedCommission = komisi nyata dari hari-hari
// yang omzet kotornya diisi (bukan estimasi), berguna untuk melihat biaya platform sebenarnya.
const salesSummary = async ({ startDate, endDate, brand }) => {
  const sales = await prisma.finDailySale.findMany({
    where: salesWhere({ startDate, endDate, brand }),
    include: SALE_INCLUDE,
    orderBy: { salesDate: 'asc' },
  });

  const blank = () => ({ gross: ZERO, fee: ZERO, net: ZERO, orders: 0, estimated: false });
  const total = blank();
  const byChannel = {};
  const byDay = {};

  for (const s of sales) {
    const bucket = (map, key, extra = {}) => (map[key] = map[key] || { ...blank(), ...extra });
    const c = bucket(byChannel, s.channel.code, {
      name: s.channel.name,
      defaultRate: s.channel.commissionRate,
      obsGross: ZERO, obsFee: ZERO, obsDays: 0,
    });
    const d = bucket(byDay, dayKey(s.salesDate));
    for (const b of [total, c, d]) {
      b.gross = b.gross.add(s.grossSales);
      b.fee = b.fee.add(s.platformFee);
      b.net = b.net.add(s.netReceived);
      b.orders += s.orderCount;
      if (s.isGrossEstimated) b.estimated = true;
    }
    if (s.channel.isOnline && !s.isGrossEstimated && D(s.grossSales).gt(0)) {
      c.obsGross = c.obsGross.add(s.grossSales);
      c.obsFee = c.obsFee.add(s.platformFee);
      c.obsDays += 1;
    }
  }

  const out = (b) => ({
    netReceived: b.net.toString(),
    netReceivable: b.net.toString(), // alias lama
    grossSales: b.gross.toString(),
    platformFee: b.fee.toString(),
    grossEstimated: b.estimated,
    orderCount: b.orders,
    averageNetPerOrder: b.orders > 0 ? b.net.div(b.orders).toDecimalPlaces(0).toString() : null,
    averageOrderValue: b.orders > 0 ? b.gross.div(b.orders).toDecimalPlaces(0).toString() : null,
  });

  const days = Object.keys(byDay).length;
  return {
    period: { startDate: dayKey(startDate), endDate: dayKey(endDate) },
    daysWithData: days,
    total: out(total),
    averageNetPerDay: days > 0 ? total.net.div(days).toDecimalPlaces(0).toString() : null,
    averageGrossPerDay: days > 0 ? total.gross.div(days).toDecimalPlaces(0).toString() : null,
    byChannel: Object.entries(byChannel).map(([code, b]) => ({
      code,
      name: b.name,
      defaultCommissionRate: D(b.defaultRate).toString(),
      observedCommission:
        b.obsDays > 0
          ? { days: b.obsDays, rate: b.obsFee.div(b.obsGross).toDecimalPlaces(4).toString() }
          : null,
      ...out(b),
    })),
    trend: Object.entries(byDay).map(([date, b]) => ({ date, ...out(b) })),
  };
};

module.exports = {
  listBrands,
  listChannels, updateChannel,
  listAccounts, createAccount,
  createSale, listSales, updateSale, voidSale, salesSummary,
};