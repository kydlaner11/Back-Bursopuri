const crypto = require('crypto');
const prisma = require('../../database/connection');
const {
  D, ZERO, notFound, conflict, badRequest, dayKey,
  todayWIB, snapshot, audit, accountBalance,
} = require('../../utils/financeUtils');

const assertNotFuture = (date) => {
  if (date > todayWIB()) throw badRequest('Tanggal transaksi tidak boleh di masa depan');
};

// ------------------------------------------------------------- CATEGORIES
const listCategories = ({ wallet } = {}) =>
  prisma.finCategory.findMany({
    where: { isActive: true, ...(wallet ? { wallet } : {}) },
    orderBy: [{ wallet: 'asc' }, { name: 'asc' }],
  });

const createCategory = async (input, userId) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.finCategory.create({ data: input });
      await audit(tx, {
        userId, action: 'CREATE', entity: 'FinCategory', entityId: category.id,
        after: snapshot(category),
      });
      return category;
    });
  } catch (e) {
    if (e.code === 'P2002') throw conflict('Kategori sudah ada pada dompet ini');
    throw e;
  }
};

// ------------------------------------------- EXPENSE / INCOME (satu akun)
const createSimple = async (type, input, userId) => {
  assertNotFuture(input.transactionDate);

  const replay = async () => {
    if (!input.idempotencyKey) return null;
    const existing = await prisma.finTransaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (!existing) return null;
    const balance = await accountBalance(prisma, existing.accountId);
    return { transaction: existing, balance: balance.toString(), replayed: true };
  };

  const replayed = await replay();
  if (replayed) return replayed;

  try {
    return await prisma.$transaction(async (tx) => {
      const account = await tx.finAccount.findUnique({ where: { id: input.accountId } });
      if (!account || !account.isActive) throw badRequest('Akun tidak ditemukan atau tidak aktif');

      if (type === 'EXPENSE' && !input.categoryId) {
        throw badRequest('Kategori wajib diisi untuk pengeluaran');
      }
      if (input.categoryId) {
        const category = await tx.finCategory.findUnique({ where: { id: input.categoryId } });
        if (!category || !category.isActive) throw badRequest('Kategori tidak ditemukan');
        if (category.wallet !== account.wallet) {
          throw badRequest(
            `Kategori "${category.name}" milik dompet ${category.wallet}, sedangkan akun "${account.name}" milik dompet ${account.wallet}`
          );
        }
      }

      const transaction = await tx.finTransaction.create({
        data: {
          accountId: input.accountId,
          categoryId: input.categoryId ?? null,
          type,
          amount: input.amount,
          transactionDate: input.transactionDate,
          description: input.description ?? null,
          reference: input.reference ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          createdById: userId,
        },
      });
      await audit(tx, {
        userId, action: 'CREATE', entity: 'FinTransaction', entityId: transaction.id,
        after: snapshot(transaction),
      });

      const balance = await accountBalance(tx, input.accountId);
      const warnings = balance.lt(0) ? [`Saldo akun "${account.name}" menjadi negatif`] : [];
      return { transaction, balance: balance.toString(), warnings, replayed: false };
    });
  } catch (e) {
    // klik ganda / request paralel dengan idempotencyKey yang sama
    if (e.code === 'P2002' && input.idempotencyKey) {
      const again = await replay();
      if (again) return again;
    }
    throw e;
  }
};

const createExpense = (input, userId) => createSimple('EXPENSE', input, userId);
const createIncome = (input, userId) => createSimple('INCOME', input, userId);

const listSimple = async (type, { startDate, endDate, wallet, categoryId }) => {
  const where = {
    type,
    isVoided: false,
    transactionDate: { gte: startDate, lte: endDate },
    ...(categoryId ? { categoryId } : {}),
    ...(wallet ? { account: { wallet } } : {}),
  };
  const [items, sum] = await Promise.all([
    prisma.finTransaction.findMany({
      where,
      include: {
        account: { select: { name: true, wallet: true } },
        category: { select: { name: true } },
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    }),
    prisma.finTransaction.aggregate({ where, _sum: { amount: true } }),
  ]);
  return { total: (sum._sum.amount || ZERO).toString(), count: items.length, items };
};

const listExpenses = (q) => listSimple('EXPENSE', q);
const listIncomes = (q) => listSimple('INCOME', q);

const voidTransaction = async (id, { reason }, userId) =>
  prisma.$transaction(async (tx) => {
    const before = await tx.finTransaction.findUnique({ where: { id } });
    if (!before || before.isVoided) throw notFound('Transaksi tidak ditemukan');
    if (before.type === 'TRANSFER_IN' || before.type === 'TRANSFER_OUT') {
      throw badRequest('Transfer dibatalkan lewat endpoint void transfer');
    }
    const after = await tx.finTransaction.update({
      where: { id },
      data: { isVoided: true, voidedAt: new Date(), voidReason: reason },
    });
    await audit(tx, {
      userId, action: 'VOID', entity: 'FinTransaction', entityId: id,
      before: snapshot(before), after: snapshot(after),
    });
    const balance = await accountBalance(tx, before.accountId);
    return { id, voided: true, balance: balance.toString() };
  });

// -------------------------------------------------------------- TRANSFER
// Transfer = dua baris berpasangan (OUT di akun asal, IN di akun tujuan), satu transferGroupId.
// Gaji pemilik = transfer usaha -> keluarga dengan reference OWNER_PAY.
const shapeTransfer = (rows) => {
  const out = rows.find((r) => r.type === 'TRANSFER_OUT');
  const inn = rows.find((r) => r.type === 'TRANSFER_IN');
  return {
    groupId: out.transferGroupId,
    transactionDate: out.transactionDate,
    amount: out.amount.toString(),
    isOwnerPay: out.reference === 'OWNER_PAY',
    description: out.description,
    from: out.account ? { id: out.accountId, name: out.account.name, wallet: out.account.wallet } : { id: out.accountId },
    to: inn && inn.account ? { id: inn.accountId, name: inn.account.name, wallet: inn.account.wallet } : { id: inn?.accountId },
  };
};

const createTransfer = async (input, userId) => {
  assertNotFuture(input.transactionDate);
  if (input.fromAccountId === input.toAccountId) {
    throw badRequest('Akun asal dan tujuan tidak boleh sama');
  }

  const replay = async () => {
    if (!input.idempotencyKey) return null;
    const out = await prisma.finTransaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (!out) return null;
    const rows = await prisma.finTransaction.findMany({
      where: { transferGroupId: out.transferGroupId },
      include: { account: { select: { name: true, wallet: true } } },
    });
    return { transfer: shapeTransfer(rows), replayed: true };
  };

  const replayed = await replay();
  if (replayed) return replayed;

  try {
    return await prisma.$transaction(async (tx) => {
      const [from, to] = await Promise.all([
        tx.finAccount.findUnique({ where: { id: input.fromAccountId } }),
        tx.finAccount.findUnique({ where: { id: input.toAccountId } }),
      ]);
      if (!from || !from.isActive) throw badRequest('Akun asal tidak ditemukan atau tidak aktif');
      if (!to || !to.isActive) throw badRequest('Akun tujuan tidak ditemukan atau tidak aktif');
      if (input.isOwnerPay && !(from.wallet === 'BUSINESS' && to.wallet === 'FAMILY')) {
        throw badRequest('Gaji pemilik harus dari akun usaha ke akun keluarga');
      }

      const transferGroupId = crypto.randomUUID();
      const common = {
        amount: input.amount,
        transactionDate: input.transactionDate,
        description: input.description ?? (input.isOwnerPay ? 'Gaji pemilik' : null),
        reference: input.isOwnerPay ? 'OWNER_PAY' : null,
        transferGroupId,
        createdById: userId,
      };
      const outRow = await tx.finTransaction.create({
        data: {
          ...common, accountId: from.id, type: 'TRANSFER_OUT',
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });
      const inRow = await tx.finTransaction.create({
        data: {
          ...common, accountId: to.id, type: 'TRANSFER_IN',
          idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:in` : null,
        },
      });
      await audit(tx, {
        userId, action: 'CREATE', entity: 'FinTransfer', entityId: transferGroupId,
        after: snapshot({ out: outRow, in: inRow }),
      });

      const [fromBalance, toBalance] = await Promise.all([
        accountBalance(tx, from.id), accountBalance(tx, to.id),
      ]);
      return {
        transfer: shapeTransfer([
          { ...outRow, account: { name: from.name, wallet: from.wallet } },
          { ...inRow, account: { name: to.name, wallet: to.wallet } },
        ]),
        balances: { from: fromBalance.toString(), to: toBalance.toString() },
        warnings: fromBalance.lt(0) ? [`Saldo akun "${from.name}" menjadi negatif`] : [],
        replayed: false,
      };
    });
  } catch (e) {
    if (e.code === 'P2002' && input.idempotencyKey) {
      const again = await replay();
      if (again) return again;
    }
    throw e;
  }
};

const listTransfers = async ({ startDate, endDate }) => {
  const rows = await prisma.finTransaction.findMany({
    where: {
      isVoided: false,
      type: { in: ['TRANSFER_OUT', 'TRANSFER_IN'] },
      transactionDate: { gte: startDate, lte: endDate },
    },
    include: { account: { select: { name: true, wallet: true } } },
    orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
  });
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.transferGroupId)) groups.set(r.transferGroupId, []);
    groups.get(r.transferGroupId).push(r);
  }
  return [...groups.values()]
    .filter((g) => g.some((r) => r.type === 'TRANSFER_OUT') && g.some((r) => r.type === 'TRANSFER_IN'))
    .map(shapeTransfer);
};

const voidTransfer = async (groupId, { reason }, userId) =>
  prisma.$transaction(async (tx) => {
    const rows = await tx.finTransaction.findMany({
      where: { transferGroupId: groupId, isVoided: false },
    });
    if (rows.length === 0) throw notFound('Transfer tidak ditemukan');

    await tx.finTransaction.updateMany({
      where: { transferGroupId: groupId },
      data: { isVoided: true, voidedAt: new Date(), voidReason: reason },
    });
    await audit(tx, {
      userId, action: 'VOID', entity: 'FinTransfer', entityId: groupId,
      before: snapshot(rows), after: snapshot({ voidReason: reason }),
    });
    return { groupId, voided: true };
  });

module.exports = {
  listCategories, createCategory,
  createExpense, createIncome, listExpenses, listIncomes, voidTransaction,
  createTransfer, listTransfers, voidTransfer,
};