// Simpan sebagai prisma/seed-finance.js
// Jalankan: node prisma/seed-finance.js   (aman dijalankan berulang, memakai upsert)
const prisma = require('../database/connection');

const channels = [
  { code: 'DEPOT',  name: 'Depot (Offline)', isOnline: false, commissionRate: '0',    priceMultiplier: '1' },
  { code: 'GOJEK',  name: 'GoFood',          isOnline: true,  commissionRate: '0.22', priceMultiplier: '1.25' },
  { code: 'GRAB',   name: 'GrabFood',        isOnline: true,  commissionRate: '0.22', priceMultiplier: '1.35' },
  { code: 'SHOPEE', name: 'ShopeeFood',      isOnline: true,  commissionRate: '0.22', priceMultiplier: '1.5' },
];

const accounts = [
  { name: 'Kas Usaha',      type: 'CASH', wallet: 'BUSINESS' },
  { name: 'Rekening Usaha', type: 'BANK', wallet: 'BUSINESS' },
  { name: 'Kas Keluarga',   type: 'CASH', wallet: 'FAMILY' },
];

const categories = [
  // Usaha
  ...['Bahan baku', 'Packaging', 'Gas', 'Marketing', 'Perawatan alat',
      'Transportasi', 'Cicilan usaha', 'Lain-lain (usaha)']
    .map((name) => ({ name, wallet: 'BUSINESS' })),
  // Keluarga
  ...['Listrik', 'PDAM', 'Internet', 'Makan', 'Bensin', 'Pulsa', 'Cicilan pribadi',
      'Arisan', 'Orang tua', 'IPL', 'Lain-lain (keluarga)']
    .map((name) => ({ name, wallet: 'FAMILY' })),
];

// Pengelompokan ini TEBAKAN, silakan koreksi lewat aplikasi nanti.
const obligations = [
  { name: 'KUR',      wallet: 'BUSINESS', kind: 'LOAN',   monthlyAmount: '4500000' },
  { name: 'Listrik',  wallet: 'FAMILY',   kind: 'BILL',   monthlyAmount: '1500000' },
  { name: 'PDAM',     wallet: 'FAMILY',   kind: 'BILL',   monthlyAmount: '180000' },
  { name: 'Indihome', wallet: 'FAMILY',   kind: 'BILL',   monthlyAmount: '410000' },
  { name: 'IPL',      wallet: 'FAMILY',   kind: 'BILL',   monthlyAmount: '230000' },
  { name: 'Motor',    wallet: 'FAMILY',   kind: 'LOAN',   monthlyAmount: '800000' },
  { name: 'KK',       wallet: 'FAMILY',   kind: 'LOAN',   monthlyAmount: '250000' },
  { name: 'Arisan',   wallet: 'FAMILY',   kind: 'SAVING', monthlyAmount: '400000' },
  { name: 'Orang tua', wallet: 'FAMILY',  kind: 'BILL',   monthlyAmount: '150000' },
];

async function main() {
  for (const c of channels) {
    await prisma.finChannel.upsert({ where: { code: c.code }, update: {}, create: c });
  }
  for (const a of accounts) {
    await prisma.finAccount.upsert({
      where: { name_wallet: { name: a.name, wallet: a.wallet } },
      update: {}, create: a,
    });
  }
  for (const c of categories) {
    await prisma.finCategory.upsert({
      where: { name_wallet: { name: c.name, wallet: c.wallet } },
      update: {}, create: c,
    });
  }
  for (const o of obligations) {
    await prisma.finObligation.upsert({
      where: { name_wallet: { name: o.name, wallet: o.wallet } },
      update: {}, create: o,
    });
  }
  console.log('Seed finance selesai');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());