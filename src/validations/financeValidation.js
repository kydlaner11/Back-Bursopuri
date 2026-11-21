const { z } = require('zod');
const { createError } = require('../helpers/errorHelpers');

// Nominal uang: angka atau string, tanpa notasi ilmiah, maks 2 desimal, tidak negatif.
const money = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .refine(
    (v) => /^\d{1,13}(\.\d{1,2})?$/.test(v),
    'Nominal tidak valid (tidak boleh negatif, maksimal 2 desimal)'
  );

const positiveMoney = money.refine((v) => Number(v) > 0, 'Nominal harus lebih dari 0');

// Tanggal bisnis YYYY-MM-DD -> Date UTC midnight (cocok dengan kolom @db.Date)
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Tanggal tidak valid')
  .transform((s) => new Date(`${s}T00:00:00.000Z`));

const uuid = z.string().uuid('ID tidak valid');

const schemas = {
  idParam: z.object({ id: uuid }),

  groupParam: z.object({ groupId: uuid }),

  createTransaction: z.object({
    accountId: uuid,
    categoryId: uuid.optional(),
    amount: positiveMoney,
    transactionDate: dateOnly,
    description: z.string().trim().max(300).optional(),
    reference: z.string().trim().max(100).optional(),
    idempotencyKey: z.string().trim().min(8).max(100).optional(),
  }),

  listTransactions: z
    .object({
      startDate: dateOnly,
      endDate: dateOnly,
      wallet: z.enum(['BUSINESS', 'FAMILY']).optional(),
      categoryId: uuid.optional(),
    })
    .refine((r) => r.startDate <= r.endDate, 'startDate tidak boleh setelah endDate')
    .refine((r) => (r.endDate - r.startDate) / 86400000 <= 365, 'Rentang maksimal 366 hari'),

  createTransfer: z.object({
    fromAccountId: uuid,
    toAccountId: uuid,
    amount: positiveMoney,
    transactionDate: dateOnly,
    description: z.string().trim().max(300).optional(),
    isOwnerPay: z.boolean().default(false), // true = gaji pemilik (usaha -> keluarga)
    idempotencyKey: z.string().trim().min(8).max(100).optional(),
  }),

  createCategory: z.object({
    name: z.string().trim().min(1).max(60),
    wallet: z.enum(['BUSINESS', 'FAMILY']),
  }),

  listCategories: z.object({ wallet: z.enum(['BUSINESS', 'FAMILY']).optional() }),

  createObligation: z.object({
    name: z.string().trim().min(1).max(80),
    wallet: z.enum(['BUSINESS', 'FAMILY']),
    kind: z.enum(['LOAN', 'BILL', 'SAVING']),
    monthlyAmount: positiveMoney,
    dueDay: z.number().int().min(1).max(31).optional(),
    endDate: dateOnly.optional(),
    notes: z.string().trim().max(300).optional(),
  }),

  updateObligation: z
    .object({
      monthlyAmount: positiveMoney.optional(),
      dueDay: z.number().int().min(1).max(31).nullable().optional(),
      endDate: dateOnly.nullable().optional(),
      isActive: z.boolean().optional(),
      notes: z.string().trim().max(300).nullable().optional(),
    })
    .refine((o) => Object.values(o).some((v) => v !== undefined), 'Minimal satu field harus diisi'),

  obligationQuery: z.object({ days: z.coerce.number().int().min(28).max(31).default(30) }),

  dashboardQuery: z
    .object({
      startDate: dateOnly.optional(),
      endDate: dateOnly.optional(),
      // asumsi margin untuk hitung titik impas; opsional sampai HPP terisi
      marginRate: z.coerce.number().min(0.05).max(0.95).optional(),
      days: z.coerce.number().int().min(28).max(31).default(30),
    })
    .refine(
      (r) => !r.startDate || !r.endDate || r.startDate <= r.endDate,
      'startDate tidak boleh setelah endDate'
    )
    .refine(
      (r) => !r.startDate || !r.endDate || (r.endDate - r.startDate) / 86400000 <= 365,
      'Rentang maksimal 366 hari'
    ),

  dateRange: z
    .object({ startDate: dateOnly, endDate: dateOnly })
    .refine((r) => r.startDate <= r.endDate, 'startDate tidak boleh setelah endDate')
    .refine(
      (r) => (r.endDate - r.startDate) / 86400000 <= 365,
      'Rentang maksimal 366 hari'
    ),

  createSale: z.object({
    salesDate: dateOnly,
    channel: z.string().trim().min(1).transform((s) => s.toUpperCase()),
    grossSales: money,
    orderCount: z.number().int().min(0).max(100000).default(0),
    notes: z.string().trim().max(500).optional(),
  }),

  updateSale: z
    .object({
      grossSales: money.optional(),
      orderCount: z.number().int().min(0).max(100000).optional(),
      notes: z.string().trim().max(500).nullable().optional(),
    })
    .refine(
      (o) => Object.values(o).some((v) => v !== undefined),
      'Minimal satu field harus diisi'
    ),

  voidSale: z.object({
    reason: z.string().trim().min(3, 'Alasan wajib diisi').max(300),
  }),

  updateChannel: z
    .object({
      commissionRate: z
        .union([z.number(), z.string()])
        .transform((v) => String(v).trim())
        .refine(
          (v) => /^(0(\.\d{1,4})?|1(\.0{1,4})?)$/.test(v),
          'Komisi harus 0 sampai 1 (contoh 0.22 untuk 22%)'
        )
        .optional(),
      priceMultiplier: z
        .union([z.number(), z.string()])
        .transform((v) => String(v).trim())
        .refine(
          (v) => /^\d{1,2}(\.\d{1,3})?$/.test(v) && Number(v) > 0,
          'Multiplier harus lebih dari 0'
        )
        .optional(),
      isActive: z.boolean().optional(),
    })
    .refine(
      (o) => Object.values(o).some((v) => v !== undefined),
      'Minimal satu field harus diisi'
    ),

  createAccount: z.object({
    name: z.string().trim().min(1).max(80),
    type: z.enum(['CASH', 'BANK', 'EWALLET']),
    wallet: z.enum(['BUSINESS', 'FAMILY']),
    openingBalance: money.default('0'),
  }),
};

// Validasi -> data bersih, atau lempar error 400 dengan pesan yang jelas
function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ');
    throw createError({ status: 400, message });
  }
  return result.data;
}

module.exports = { schemas, validate };